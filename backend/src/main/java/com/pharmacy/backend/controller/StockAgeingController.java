package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.Medicine;
import com.pharmacy.backend.model.MedicineMaster;
import com.pharmacy.backend.repository.MedicineRepository;
import com.pharmacy.backend.repository.MedicineMasterRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api/stock-ageing")
public class StockAgeingController {

    @Autowired
    private MedicineRepository medicineRepository;

    @Autowired
    private MedicineMasterRepository medicineMasterRepository;

    @GetMapping("/report")
    public ResponseEntity<StockAgeingReport> getReport(
            @RequestParam(defaultValue = "30") int freshLimit,
            @RequestParam(defaultValue = "90") int moderateLimit,
            @RequestParam(defaultValue = "180") int slowMovingLimit
    ) {
        List<Medicine> activeStock = medicineRepository.findByActiveTrue();
        LocalDate today = LocalDate.now();

        // 1. Pre-calculate master configurations to speed up value computations
        Map<String, MasterConfig> masterConfigMap = new HashMap<>();
        for (Medicine med : activeStock) {
            String sku = med.getSku();
            if (!masterConfigMap.containsKey(sku)) {
                Optional<MedicineMaster> masterOpt = medicineMasterRepository.findFirstByProductCodeAndActiveTrue(sku);
                int packSize = 10;
                String category = "medicine";
                if (masterOpt.isPresent()) {
                    MedicineMaster mm = masterOpt.get();
                    String pType = mm.getProductType() != null ? mm.getProductType().toLowerCase() : "";
                    boolean isTabletOrCapsule = pType.contains("tablet") || pType.contains("capsule");
                    packSize = isTabletOrCapsule ? parsePackSize(mm.getProductQuantity()) : 1;
                    category = mm.getCategory() != null ? mm.getCategory() : "medicine";
                }
                masterConfigMap.put(sku, new MasterConfig(packSize, category));
            }
        }

        // Bracket Totals definitions dynamically built
        Bracket freshBracket = new Bracket("Fresh (0-" + freshLimit + " days)", "0-30");
        Bracket moderateBracket = new Bracket("Moderate (" + (freshLimit + 1) + "-" + moderateLimit + " days)", "31-90");
        Bracket warningBracket = new Bracket("Slow-Moving (" + (moderateLimit + 1) + "-" + slowMovingLimit + " days)", "91-180");
        Bracket stagnantBracket = new Bracket("Stagnant (>" + slowMovingLimit + " days)", "gt180");

        Bracket expExpired = new Bracket("Expired", "Expired");
        Bracket expCritical = new Bracket("Critical (0-90 days to expiry)", "0-90");
        Bracket expWarning = new Bracket("Warning (91-180 days to expiry)", "91-180");
        Bracket expHealthy = new Bracket("Healthy (>180 days to expiry)", "gt180");

        double totalInventoryValue = 0.0;
        List<BatchAgeingDetails> detailsList = new ArrayList<>();
        List<BatchAgeingDetails> alertsList = new ArrayList<>();

        for (Medicine med : activeStock) {
            if (med.getStockLevel() <= 0) continue;

            MasterConfig cfg = masterConfigMap.getOrDefault(med.getSku(), new MasterConfig(10, "medicine"));
            // costPrice is stored as per-strip landed cost (set by PurchaseBillController)
            double valueAtCost = med.getStockLevel() * med.getCostPrice();
            totalInventoryValue += valueAtCost;

            // Ageing calculations
            LocalDate purchaseDate = med.getPurchaseDate() != null ? med.getPurchaseDate() : today;
            long shelfAgeDays = ChronoUnit.DAYS.between(purchaseDate, today);
            long daysToExpiry = ChronoUnit.DAYS.between(today, med.getExpiryDate());

            String shelfAgeBracketStr;
            Bracket shelfTarget;
            if (shelfAgeDays <= freshLimit) {
                shelfAgeBracketStr = "Fresh";
                shelfTarget = freshBracket;
            } else if (shelfAgeDays <= moderateLimit) {
                shelfAgeBracketStr = "Moderate";
                shelfTarget = moderateBracket;
            } else if (shelfAgeDays <= slowMovingLimit) {
                shelfAgeBracketStr = "Slow-Moving";
                shelfTarget = warningBracket;
            } else {
                shelfAgeBracketStr = "Stagnant";
                shelfTarget = stagnantBracket;
            }

            String expiryRiskBracketStr;
            Bracket expiryTarget;
            if (daysToExpiry <= 0) {
                expiryRiskBracketStr = "Expired";
                expiryTarget = expExpired;
            } else if (daysToExpiry <= 90) {
                expiryRiskBracketStr = "Critical";
                expiryTarget = expCritical;
            } else if (daysToExpiry <= 180) {
                expiryRiskBracketStr = "Warning";
                expiryTarget = expWarning;
            } else {
                expiryRiskBracketStr = "Healthy";
                expiryTarget = expHealthy;
            }

            // Update aggregates
            shelfTarget.add(valueAtCost, 1);
            expiryTarget.add(valueAtCost, 1);

            BatchAgeingDetails details = new BatchAgeingDetails(
                    med.getId(),
                    med.getName(),
                    med.getSku(),
                    med.getBatchNumber(),
                    med.getExpiryDate(),
                    med.getPurchaseDate(),
                    med.getStockLevel(),
                    med.getCostPrice(),
                    med.getSellingPrice(),
                    med.getRackLocation(),
                    med.getManufacturer(),
                    cfg.category,
                    shelfAgeDays,
                    daysToExpiry,
                    shelfAgeBracketStr,
                    expiryRiskBracketStr,
                    valueAtCost
            );

            detailsList.add(details);

            // Stagnant Stock Alert Condition: Shelf Age > moderateLimit and stock exists
            if (shelfAgeDays > moderateLimit) {
                alertsList.add(details);
            }
        }

        // Calculate percentages
        double finalTotalValue = totalInventoryValue;
        freshBracket.calculatePercentage(finalTotalValue);
        moderateBracket.calculatePercentage(finalTotalValue);
        warningBracket.calculatePercentage(finalTotalValue);
        stagnantBracket.calculatePercentage(finalTotalValue);

        expExpired.calculatePercentage(finalTotalValue);
        expCritical.calculatePercentage(finalTotalValue);
        expWarning.calculatePercentage(finalTotalValue);
        expHealthy.calculatePercentage(finalTotalValue);

        // Sort lists for view presentation
        detailsList.sort((a, b) -> Long.compare(b.shelfAgeDays, a.shelfAgeDays));
        alertsList.sort((a, b) -> Double.compare(b.valueAtCost, a.valueAtCost)); // alert top by value at risk

        StockAgeingReport report = new StockAgeingReport(
                totalInventoryValue,
                Arrays.asList(freshBracket, moderateBracket, warningBracket, stagnantBracket),
                Arrays.asList(expExpired, expCritical, expWarning, expHealthy),
                alertsList,
                detailsList
        );

        return ResponseEntity.ok(report);
    }

    private int parsePackSize(String productQuantity) {
        if (productQuantity == null || productQuantity.trim().isEmpty()) {
            return 10;
        }
        try {
            String numStr = productQuantity.replaceAll("[^0-9]", "");
            if (!numStr.isEmpty()) {
                return Integer.parseInt(numStr);
            }
        } catch (Exception e) {
            // ignore
        }
        return 10;
    }

    // --- Helper Models & DTOs ---

    private static class MasterConfig {
        int packSize;
        String category;

        MasterConfig(int packSize, String category) {
            this.packSize = packSize;
            this.category = category;
        }
    }

    public static class Bracket {
        private String name;
        private String rangeCode;
        private double totalValue;
        private int itemCount;
        private double percentage;

        public Bracket(String name, String rangeCode) {
            this.name = name;
            this.rangeCode = rangeCode;
        }

        public void add(double val, int count) {
            this.totalValue += val;
            this.itemCount += count;
        }

        public void calculatePercentage(double overallTotal) {
            if (overallTotal > 0.0) {
                this.percentage = Math.round((this.totalValue / overallTotal) * 1000.0) / 10.0;
            } else {
                this.percentage = 0.0;
            }
            this.totalValue = Math.round(this.totalValue * 100.0) / 100.0;
        }

        public String getName() { return name; }
        public String getRangeCode() { return rangeCode; }
        public double getTotalValue() { return totalValue; }
        public int getItemCount() { return itemCount; }
        public double getPercentage() { return percentage; }
    }

    public static class BatchAgeingDetails {
        private Long id;
        private String name;
        private String sku;
        private String batchNumber;
        private LocalDate expiryDate;
        private LocalDate purchaseDate;
        private int stockLevel;
        private double costPrice;
        private double sellingPrice;
        private String rackLocation;
        private String manufacturer;
        private String category;
        private long shelfAgeDays;
        private long daysToExpiry;
        private String shelfAgeBracket;
        private String expiryRiskBracket;
        private double valueAtCost;

        public BatchAgeingDetails(Long id, String name, String sku, String batchNumber, LocalDate expiryDate,
                                  LocalDate purchaseDate, int stockLevel, double costPrice, double sellingPrice,
                                  String rackLocation, String manufacturer, String category, long shelfAgeDays,
                                  long daysToExpiry, String shelfAgeBracket, String expiryRiskBracket, double valueAtCost) {
            this.id = id;
            this.name = name;
            this.sku = sku;
            this.batchNumber = batchNumber;
            this.expiryDate = expiryDate;
            this.purchaseDate = purchaseDate;
            this.stockLevel = stockLevel;
            this.costPrice = costPrice;
            this.sellingPrice = sellingPrice;
            this.rackLocation = rackLocation;
            this.manufacturer = manufacturer;
            this.category = category;
            this.shelfAgeDays = shelfAgeDays;
            this.daysToExpiry = daysToExpiry;
            this.shelfAgeBracket = shelfAgeBracket;
            this.expiryRiskBracket = expiryRiskBracket;
            this.valueAtCost = Math.round(valueAtCost * 100.0) / 100.0;
        }

        // Getters
        public Long getId() { return id; }
        public String getName() { return name; }
        public String getSku() { return sku; }
        public String getBatchNumber() { return batchNumber; }
        public LocalDate getExpiryDate() { return expiryDate; }
        public LocalDate getPurchaseDate() { return purchaseDate; }
        public int getStockLevel() { return stockLevel; }
        public double getCostPrice() { return costPrice; }
        public double getSellingPrice() { return sellingPrice; }
        public String getRackLocation() { return rackLocation; }
        public String getManufacturer() { return manufacturer; }
        public String getCategory() { return category; }
        public long getShelfAgeDays() { return shelfAgeDays; }
        public long getDaysToExpiry() { return daysToExpiry; }
        public String getShelfAgeBracket() { return shelfAgeBracket; }
        public String getExpiryRiskBracket() { return expiryRiskBracket; }
        public double getValueAtCost() { return valueAtCost; }
    }

    public static class StockAgeingReport {
        private double totalInventoryValue;
        private List<Bracket> shelfAgeing;
        private List<Bracket> expiryRisk;
        private List<BatchAgeingDetails> stagnantAlerts;
        private List<BatchAgeingDetails> allBatches;

        public StockAgeingReport(double totalInventoryValue, List<Bracket> shelfAgeing, List<Bracket> expiryRisk,
                                 List<BatchAgeingDetails> stagnantAlerts, List<BatchAgeingDetails> allBatches) {
            this.totalInventoryValue = Math.round(totalInventoryValue * 100.0) / 100.0;
            this.shelfAgeing = shelfAgeing;
            this.expiryRisk = expiryRisk;
            this.stagnantAlerts = stagnantAlerts;
            this.allBatches = allBatches;
        }

        public double getTotalInventoryValue() { return totalInventoryValue; }
        public List<Bracket> getShelfAgeing() { return shelfAgeing; }
        public List<Bracket> getExpiryRisk() { return expiryRisk; }
        public List<BatchAgeingDetails> getStagnantAlerts() { return stagnantAlerts; }
        public List<BatchAgeingDetails> getAllBatches() { return allBatches; }
    }
}
