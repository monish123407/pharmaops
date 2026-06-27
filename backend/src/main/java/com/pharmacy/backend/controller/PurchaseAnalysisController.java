package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.*;
import com.pharmacy.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/purchase/analysis")
public class PurchaseAnalysisController {

    @Autowired
    private PurchaseBillRepository purchaseBillRepository;

    @Autowired
    private MedicineMasterRepository medicineMasterRepository;

    @GetMapping("/summary")
    public PurchaseAnalysisSummary getPurchaseAnalysisSummary(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        // 1. Safe Date Range Parsing (defaulting to current month)
        LocalDate startLocalDate;
        LocalDate endLocalDate;

        try {
            if (startDate == null || startDate.trim().isEmpty()) {
                startLocalDate = LocalDate.now().withDayOfMonth(1);
            } else {
                startLocalDate = LocalDate.parse(startDate);
            }
        } catch (Exception e) {
            startLocalDate = LocalDate.now().withDayOfMonth(1);
        }

        try {
            if (endDate == null || endDate.trim().isEmpty()) {
                endLocalDate = LocalDate.now().with(java.time.temporal.TemporalAdjusters.lastDayOfMonth());
            } else {
                endLocalDate = LocalDate.parse(endDate);
            }
        } catch (Exception e) {
            endLocalDate = LocalDate.now().with(java.time.temporal.TemporalAdjusters.lastDayOfMonth());
        }

        LocalDateTime startDateTime = startLocalDate.atStartOfDay();
        LocalDateTime endDateTime = endLocalDate.atTime(23, 59, 59);

        // Calculate duration and previous period dates for comparison
        long durationDays = ChronoUnit.DAYS.between(startLocalDate, endLocalDate);
        if (durationDays < 0) durationDays = 0;

        LocalDate prevStartLocalDate = startLocalDate.minusDays(durationDays + 1);
        LocalDate prevEndLocalDate = startLocalDate.minusDays(1);
        
        LocalDateTime prevStartDateTime = prevStartLocalDate.atStartOfDay();
        LocalDateTime prevEndDateTime = prevEndLocalDate.atTime(23, 59, 59);

        // 2. Fetch Purchase Bills within Current & Previous periods
        List<PurchaseBill> currentBills = purchaseBillRepository.findPurchaseBillsBetween(startDateTime, endDateTime);
        List<PurchaseBill> previousBills = purchaseBillRepository.findPurchaseBillsBetween(prevStartDateTime, prevEndDateTime);

        // Fetch Medicine Masters for Category mapping
        List<MedicineMaster> mastersList = medicineMasterRepository.findAll();
        Map<String, String> skuCategoryMap = new HashMap<>();
        Map<String, MedicineMaster> masterByCodeMap = new HashMap<>();
        for (MedicineMaster mm : mastersList) {
            if (mm != null && mm.getProductCode() != null) {
                skuCategoryMap.put(mm.getProductCode(), mm.getCategory() != null ? mm.getCategory() : "medicine");
                masterByCodeMap.put(mm.getProductCode(), mm);
            }
        }

        // 3. Compute Metrics for Current Period
        PeriodMetrics currentMetrics = calculatePeriodMetrics(currentBills, skuCategoryMap);

        // 4. Compute Metrics for Previous Period
        PeriodMetrics previousMetrics = calculatePeriodMetrics(previousBills, skuCategoryMap);

        // 5. Build KPI Summary cards
        PurchaseAnalysisSummary summary = new PurchaseAnalysisSummary();
        summary.setGrossPurchases(buildKpi(currentMetrics.grossPurchases, previousMetrics.grossPurchases));
        summary.setNetProcurement(buildKpi(currentMetrics.netProcurement, previousMetrics.netProcurement));
        summary.setTaxPaid(buildKpi(currentMetrics.taxPaid, previousMetrics.taxPaid));
        summary.setDiscountsReceived(buildKpi(currentMetrics.discountTotal, previousMetrics.discountTotal));
        summary.setTotalInvoices(buildKpi((double) currentMetrics.totalInvoices, (double) previousMetrics.totalInvoices));
        summary.setAvgInvoiceValue(buildKpi(currentMetrics.avgInvoiceValue, previousMetrics.avgInvoiceValue));

        // 6. Build Daily Procurement Trend Curve
        summary.setDailyTrend(buildDailyTrend(currentBills, startLocalDate, endLocalDate));

        // 7. Wholesaler Budget Share Splits
        summary.setWholesalerShares(buildWholesalerShares(currentBills, currentMetrics.netProcurement));

        // 8. Category splits of purchases
        summary.setCategorySplits(buildCategoryShares(currentMetrics.categoryCost, currentMetrics.netProcurement));

        // 9. Product Procurement Grid
        summary.setProductsPerformance(buildProductsPerformance(currentMetrics.productStats, masterByCodeMap));

        // 10. Automated Invoicing Insights & Recommendations
        summary.setInsights(generateInsights(currentMetrics, currentBills));

        return summary;
    }

    private PeriodMetrics calculatePeriodMetrics(List<PurchaseBill> bills, Map<String, String> skuCategoryMap) {
        PeriodMetrics m = new PeriodMetrics();
        m.totalInvoices = bills.size();

        for (PurchaseBill bill : bills) {
            if (bill == null || !bill.isActive()) continue;

            m.grossPurchases += bill.getGrossAmount() != null ? bill.getGrossAmount() : 0.0;
            m.discountTotal += bill.getDiscountAmount() != null ? bill.getDiscountAmount() : 0.0;
            m.taxPaid += (bill.getCgstAmount() != null ? bill.getCgstAmount() : 0.0) + (bill.getSgstAmount() != null ? bill.getSgstAmount() : 0.0);
            m.netProcurement += bill.getTotalAmount() != null ? bill.getTotalAmount() : 0.0;

            if (bill.getItems() != null) {
                for (PurchaseBillItem item : bill.getItems()) {
                    if (item == null) continue;

                    String sku = item.getProductCode() != null ? item.getProductCode() : "";
                    if (sku.isEmpty()) {
                        sku = "SKU-" + item.getProductName().replaceAll("[^A-Za-z0-9]", "").toUpperCase();
                    }

                    int totalQty = (item.getQuantity() != null ? item.getQuantity() : 0) + (item.getLoose() != null ? item.getLoose() : 0);
                    double itemTotalCost = item.getTaxableAmount() != null ? item.getTaxableAmount() : 0.0;
                    double itemGross = item.getTotal() != null ? item.getTotal() : 0.0;
                    double itemDiscount = itemGross - itemTotalCost;
                    double itemTax = (item.getCgstAmount() != null ? item.getCgstAmount() : 0.0) + (item.getSgstAmount() != null ? item.getSgstAmount() : 0.0);

                    // Group by formulation category (from master SKU mapping)
                    String category = skuCategoryMap.getOrDefault(sku, "medicine");
                    category = category.trim().toLowerCase();
                    m.categoryCost.put(category, m.categoryCost.getOrDefault(category, 0.0) + itemTotalCost + itemTax);

                    // Aggregate Product Procurement details
                    ProductStat stat = m.productStats.computeIfAbsent(sku, s -> {
                        ProductStat ps = new ProductStat();
                        ps.sku = s;
                        ps.name = item.getProductName();
                        ps.quantityPurchased = 0;
                        ps.totalCost = 0.0;
                        ps.totalTax = 0.0;
                        ps.totalDiscount = 0.0;
                        ps.totalMRP = 0.0;
                        return ps;
                    });
                    stat.quantityPurchased += totalQty;
                    stat.totalCost += itemTotalCost;
                    stat.totalTax += itemTax;
                    stat.totalDiscount += itemDiscount;
                    stat.totalMRP += (item.getMrp() != null ? item.getMrp() : 0.0) * totalQty;
                }
            }
        }

        m.avgInvoiceValue = m.totalInvoices > 0 ? m.netProcurement / m.totalInvoices : 0.0;
        return m;
    }

    private KpiSummary buildKpi(Double current, Double previous) {
        KpiSummary kpi = new KpiSummary();
        kpi.setCurrentValue(current);
        kpi.setPreviousValue(previous);

        if (previous == null || previous == 0.0) {
            kpi.setGrowthPercentage(current > 0 ? 100.0 : 0.0);
            kpi.setTrendDirection(current > 0 ? "UP" : "FLAT");
        } else {
            double diff = current - previous;
            double growth = (diff / previous) * 100.0;
            growth = Math.round(growth * 100.0) / 100.0;
            kpi.setGrowthPercentage(growth);
            if (growth > 0.5) {
                kpi.setTrendDirection("UP");
            } else if (growth < -0.5) {
                kpi.setTrendDirection("DOWN");
            } else {
                kpi.setTrendDirection("FLAT");
            }
        }
        return kpi;
    }

    private List<DailyPoint> buildDailyTrend(List<PurchaseBill> bills, LocalDate startLocalDate, LocalDate endLocalDate) {
        Map<String, Double> dailyCost = new TreeMap<>();
        Map<String, Long> dailyCounts = new TreeMap<>();
        DateTimeFormatter df = DateTimeFormatter.ofPattern("yyyy-MM-dd");

        // Pre-initialize all dates in range
        long daysBetween = ChronoUnit.DAYS.between(startLocalDate, endLocalDate);
        for (int i = 0; i <= daysBetween; i++) {
            String dateLabel = startLocalDate.plusDays(i).format(df);
            dailyCost.put(dateLabel, 0.0);
            dailyCounts.put(dateLabel, 0L);
        }

        for (PurchaseBill bill : bills) {
            if (bill == null || bill.getPurchaseDate() == null || !bill.isActive()) continue;
            String dayStr = bill.getPurchaseDate().toLocalDate().format(df);
            if (dailyCost.containsKey(dayStr)) {
                double total = bill.getTotalAmount() != null ? bill.getTotalAmount() : 0.0;
                dailyCost.put(dayStr, dailyCost.get(dayStr) + total);
                dailyCounts.put(dayStr, dailyCounts.get(dayStr) + 1L);
            }
        }

        List<DailyPoint> trend = new ArrayList<>();
        dailyCost.forEach((date, cost) -> {
            trend.add(new DailyPoint(date, cost, dailyCounts.get(date)));
        });
        return trend;
    }

    private List<WholesalerShare> buildWholesalerShares(List<PurchaseBill> bills, double totalNetProcurement) {
        Map<String, Double> costMap = new HashMap<>();
        Map<String, Long> countMap = new HashMap<>();

        for (PurchaseBill bill : bills) {
            if (bill == null || !bill.isActive()) continue;
            String sup = bill.getSupplierName() != null ? bill.getSupplierName().trim() : "Unknown supplier";
            double amount = bill.getTotalAmount() != null ? bill.getTotalAmount() : 0.0;

            costMap.put(sup, costMap.getOrDefault(sup, 0.0) + amount);
            countMap.put(sup, countMap.getOrDefault(sup, 0L) + 1L);
        }

        double totalAcc = totalNetProcurement > 0 ? totalNetProcurement : 1.0;
        List<WholesalerShare> shares = new ArrayList<>();

        costMap.forEach((sup, amt) -> {
            double share = (amt / totalAcc) * 100.0;
            WholesalerShare ws = new WholesalerShare();
            ws.setWholesalerName(sup);
            ws.setPurchaseAmount(Math.round(amt * 100.0) / 100.0);
            ws.setInvoiceCount(countMap.get(sup));
            ws.setPercentageShare(Math.round(share * 100.0) / 100.0);
            shares.add(ws);
        });

        shares.sort((a, b) -> Double.compare(b.getPurchaseAmount(), a.getPurchaseAmount()));
        return shares;
    }

    private List<CategoryShare> buildCategoryShares(Map<String, Double> categoryCost, double totalNetProcurement) {
        List<CategoryShare> splits = new ArrayList<>();
        double totalAcc = totalNetProcurement > 0 ? totalNetProcurement : 1.0;

        categoryCost.forEach((cat, amt) -> {
            double share = (amt / totalAcc) * 100.0;
            CategoryShare cs = new CategoryShare();
            cs.setCategory(cat.substring(0, 1).toUpperCase() + cat.substring(1));
            cs.setPurchaseAmount(Math.round(amt * 100.0) / 100.0);
            cs.setPurchaseSharePercentage(Math.round(share * 100.0) / 100.0);
            splits.add(cs);
        });

        splits.sort((a, b) -> Double.compare(b.getPurchaseAmount(), a.getPurchaseAmount()));
        return splits;
    }

    private List<ProductProcurement> buildProductsPerformance(Map<String, ProductStat> stats, Map<String, MedicineMaster> masterByCodeMap) {
        List<ProductProcurement> performanceList = new ArrayList<>();

        stats.forEach((sku, ps) -> {
            ProductProcurement pp = new ProductProcurement();
            pp.setSku(sku);
            pp.setName(ps.name);
            pp.setQuantityPurchased(ps.quantityPurchased);
            pp.setTotalCost(Math.round(ps.totalCost * 100.0) / 100.0);
            pp.setTotalTax(Math.round(ps.totalTax * 100.0) / 100.0);
            pp.setTotalDiscount(Math.round(ps.totalDiscount * 100.0) / 100.0);
            
            double totalVal = ps.totalCost + ps.totalTax;
            pp.setTotalProcurementValue(Math.round(totalVal * 100.0) / 100.0);

            double avgCost = ps.quantityPurchased > 0 ? ps.totalCost / ps.quantityPurchased : 0.0;
            pp.setAverageCostRate(Math.round(avgCost * 100.0) / 100.0);

            double avgMRP = ps.quantityPurchased > 0 ? ps.totalMRP / ps.quantityPurchased : 0.0;
            pp.setAverageMRP(Math.round(avgMRP * 100.0) / 100.0);

            MedicineMaster mm = masterByCodeMap.get(sku);
            pp.setComposition(mm != null ? mm.getComposition() : "General Composition");
            pp.setRackLocation(mm != null && mm.getRackLocation() != null ? mm.getRackLocation() : "A-01");

            performanceList.add(pp);
        });

        performanceList.sort((a, b) -> Double.compare(b.getTotalProcurementValue(), a.getTotalProcurementValue()));
        return performanceList;
    }

    private List<InsightRecommendation> generateInsights(PeriodMetrics metrics, List<PurchaseBill> bills) {
        List<InsightRecommendation> insights = new ArrayList<>();

        // Insight 1: Budget concentration
        List<WholesalerShare> shares = buildWholesalerShares(bills, metrics.netProcurement);
        if (!shares.isEmpty()) {
            WholesalerShare top = shares.get(0);
            if (top.getPercentageShare() > 60.0) {
                insights.add(new InsightRecommendation(
                        "WARNING",
                        "High Wholesaler Concentration Risk",
                        String.format("Wholesaler '%s' represents %.1f%% of your total purchase budget.", top.getWholesalerName(), top.getPercentageShare()),
                        "Consider splitting bulk indents across alternative local wholesalers to mitigate vendor risk and lock-in competitive rates."
                ));
            } else {
                insights.add(new InsightRecommendation(
                        "SUCCESS",
                        "Supplier Portfolio Well Diversified",
                        String.format("Top wholesaler '%s' accounts for a healthy %.1f%% of procurement volume.", top.getWholesalerName(), top.getPercentageShare()),
                        "Maintain standard weekly ordering indent cycles to sustain competitive volume brackets."
                ));
            }
        }

        // Insight 2: Discount analysis
        double discPercentage = metrics.grossPurchases > 0 ? (metrics.discountTotal / metrics.grossPurchases) * 100.0 : 0.0;
        if (discPercentage < 5.0) {
            insights.add(new InsightRecommendation(
                    "WARNING",
                    "Lower Average Supplier Discount Margins",
                    String.format("Average discount received on wholesaler invoices stands at a lower %.1f%%.", discPercentage),
                    "Negotiate stronger volume margin schemes or trade discounts on standard medicines with manufacturers."
            ));
        } else {
            insights.add(new InsightRecommendation(
                    "SUCCESS",
                    "Excellent Wholesale Discounts Saved",
                    String.format("Average composite discount on purchase entries is %.1f%%.", discPercentage),
                    "Continue prioritizing bulk invoicing orders that leverage trade-specific margin discounts."
            ));
        }

        // Insight 3: Tax paid allocation
        insights.add(new InsightRecommendation(
                "INFO",
                "Compliant GST Tax Summary Splits",
                String.format("GST tax split paid to wholesalers this period is ₹%.2f.", metrics.taxPaid),
                "Use the dynamically generated Purchase Analytics report to reconcile monthly Input Tax Credit (ITC) filings securely."
        ));

        return insights;
    }

    // Helper classes for metrics
    private static class PeriodMetrics {
        double grossPurchases = 0.0;
        double discountTotal = 0.0;
        double taxPaid = 0.0;
        double netProcurement = 0.0;
        int totalInvoices = 0;
        double avgInvoiceValue = 0.0;

        Map<String, Double> categoryCost = new HashMap<>();
        Map<String, ProductStat> productStats = new HashMap<>();
    }

    private static class ProductStat {
        String sku;
        String name;
        int quantityPurchased;
        double totalCost;
        double totalTax;
        double totalDiscount;
        double totalMRP;
    }

    // JSON Model structures
    public static class PurchaseAnalysisSummary {
        private KpiSummary grossPurchases;
        private KpiSummary netProcurement;
        private KpiSummary taxPaid;
        private KpiSummary discountsReceived;
        private KpiSummary totalInvoices;
        private KpiSummary avgInvoiceValue;

        private List<DailyPoint> dailyTrend;
        private List<WholesalerShare> wholesalerShares;
        private List<CategoryShare> categorySplits;
        private List<ProductProcurement> productsPerformance;
        private List<InsightRecommendation> insights;

        public KpiSummary getGrossPurchases() { return grossPurchases; }
        public void setGrossPurchases(KpiSummary grossPurchases) { this.grossPurchases = grossPurchases; }

        public KpiSummary getNetProcurement() { return netProcurement; }
        public void setNetProcurement(KpiSummary netProcurement) { this.netProcurement = netProcurement; }

        public KpiSummary getTaxPaid() { return taxPaid; }
        public void setTaxPaid(KpiSummary taxPaid) { this.taxPaid = taxPaid; }

        public KpiSummary getDiscountsReceived() { return discountsReceived; }
        public void setDiscountsReceived(KpiSummary discountsReceived) { this.discountsReceived = discountsReceived; }

        public KpiSummary getTotalInvoices() { return totalInvoices; }
        public void setTotalInvoices(KpiSummary totalInvoices) { this.totalInvoices = totalInvoices; }

        public KpiSummary getAvgInvoiceValue() { return avgInvoiceValue; }
        public void setAvgInvoiceValue(KpiSummary avgInvoiceValue) { this.avgInvoiceValue = avgInvoiceValue; }

        public List<DailyPoint> getDailyTrend() { return dailyTrend; }
        public void setDailyTrend(List<DailyPoint> dailyTrend) { this.dailyTrend = dailyTrend; }

        public List<WholesalerShare> getWholesalerShares() { return wholesalerShares; }
        public void setWholesalerShares(List<WholesalerShare> wholesalerShares) { this.wholesalerShares = wholesalerShares; }

        public List<CategoryShare> getCategorySplits() { return categorySplits; }
        public void setCategorySplits(List<CategoryShare> categorySplits) { this.categorySplits = categorySplits; }

        public List<ProductProcurement> getProductsPerformance() { return productsPerformance; }
        public void setProductsPerformance(List<ProductProcurement> productsPerformance) { this.productsPerformance = productsPerformance; }

        public List<InsightRecommendation> getInsights() { return insights; }
        public void setInsights(List<InsightRecommendation> insights) { this.insights = insights; }
    }

    public static class KpiSummary {
        private Double currentValue;
        private Double previousValue;
        private Double growthPercentage;
        private String trendDirection;

        public Double getCurrentValue() { return currentValue; }
        public void setCurrentValue(Double currentValue) { this.currentValue = currentValue; }

        public Double getPreviousValue() { return previousValue; }
        public void setPreviousValue(Double previousValue) { this.previousValue = previousValue; }

        public Double getGrowthPercentage() { return growthPercentage; }
        public void setGrowthPercentage(Double growthPercentage) { this.growthPercentage = growthPercentage; }

        public String getTrendDirection() { return trendDirection; }
        public void setTrendDirection(String trendDirection) { this.trendDirection = trendDirection; }
    }

    public static class DailyPoint {
        private String date;
        private Double purchaseAmount;
        private Long invoiceCount;

        public DailyPoint() {}
        public DailyPoint(String date, Double purchaseAmount, Long invoiceCount) {
            this.date = date;
            this.purchaseAmount = Math.round(purchaseAmount * 100.0) / 100.0;
            this.invoiceCount = invoiceCount;
        }

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public Double getPurchaseAmount() { return purchaseAmount; }
        public void setPurchaseAmount(Double purchaseAmount) { this.purchaseAmount = purchaseAmount; }

        public Long getInvoiceCount() { return invoiceCount; }
        public void setInvoiceCount(Long invoiceCount) { this.invoiceCount = invoiceCount; }
    }

    public static class WholesalerShare {
        private String wholesalerName;
        private Double purchaseAmount;
        private Long invoiceCount;
        private Double percentageShare;

        public String getWholesalerName() { return wholesalerName; }
        public void setWholesalerName(String wholesalerName) { this.wholesalerName = wholesalerName; }

        public Double getPurchaseAmount() { return purchaseAmount; }
        public void setPurchaseAmount(Double purchaseAmount) { this.purchaseAmount = purchaseAmount; }

        public Long getInvoiceCount() { return invoiceCount; }
        public void setInvoiceCount(Long invoiceCount) { this.invoiceCount = invoiceCount; }

        public Double getPercentageShare() { return percentageShare; }
        public void setPercentageShare(Double percentageShare) { this.percentageShare = percentageShare; }
    }

    public static class CategoryShare {
        private String category;
        private Double purchaseAmount;
        private Double purchaseSharePercentage;

        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }

        public Double getPurchaseAmount() { return purchaseAmount; }
        public void setPurchaseAmount(Double purchaseAmount) { this.purchaseAmount = purchaseAmount; }

        public Double getPurchaseSharePercentage() { return purchaseSharePercentage; }
        public void setPurchaseSharePercentage(Double purchaseSharePercentage) { this.purchaseSharePercentage = purchaseSharePercentage; }
    }

    public static class ProductProcurement {
        private String sku;
        private String name;
        private Integer quantityPurchased;
        private Double totalCost;
        private Double totalTax;
        private Double totalDiscount;
        private Double totalProcurementValue;
        private Double averageCostRate;
        private Double averageMRP;
        private String composition;
        private String rackLocation;

        public String getSku() { return sku; }
        public void setSku(String sku) { this.sku = sku; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public Integer getQuantityPurchased() { return quantityPurchased; }
        public void setQuantityPurchased(Integer quantityPurchased) { this.quantityPurchased = quantityPurchased; }

        public Double getTotalCost() { return totalCost; }
        public void setTotalCost(Double totalCost) { this.totalCost = totalCost; }

        public Double getTotalTax() { return totalTax; }
        public void setTotalTax(Double totalTax) { this.totalTax = totalTax; }

        public Double getTotalDiscount() { return totalDiscount; }
        public void setTotalDiscount(Double totalDiscount) { this.totalDiscount = totalDiscount; }

        public Double getTotalProcurementValue() { return totalProcurementValue; }
        public void setTotalProcurementValue(Double totalProcurementValue) { this.totalProcurementValue = totalProcurementValue; }

        public Double getAverageCostRate() { return averageCostRate; }
        public void setAverageCostRate(Double averageCostRate) { this.averageCostRate = averageCostRate; }

        public Double getAverageMRP() { return averageMRP; }
        public void setAverageMRP(Double averageMRP) { this.averageMRP = averageMRP; }

        public String getComposition() { return composition; }
        public void setComposition(String composition) { this.composition = composition; }

        public String getRackLocation() { return rackLocation; }
        public void setRackLocation(String rackLocation) { this.rackLocation = rackLocation; }
    }

    public static class InsightRecommendation {
        private String type;
        private String title;
        private String description;
        private String suggestion;

        public InsightRecommendation() {}
        public InsightRecommendation(String type, String title, String description, String suggestion) {
            this.type = type;
            this.title = title;
            this.description = description;
            this.suggestion = suggestion;
        }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public String getSuggestion() { return suggestion; }
        public void setSuggestion(String suggestion) { this.suggestion = suggestion; }
    }
}
