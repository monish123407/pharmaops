package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.Medicine;
import com.pharmacy.backend.model.PurchaseBill;
import com.pharmacy.backend.model.PurchaseBillItem;
import com.pharmacy.backend.repository.MedicineRepository;
import com.pharmacy.backend.repository.PurchaseBillRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/expired-stockout")
@CrossOrigin
public class ExpiredStockoutController {

    @Autowired
    private MedicineRepository medicineRepository;

    @Autowired
    private PurchaseBillRepository purchaseBillRepository;

    @GetMapping("/expired")
    public ResponseEntity<List<ExpiredStockoutItem>> getExpiredByWholesaler(@RequestParam("wholesaler") String wholesaler) {
        if (wholesaler == null || wholesaler.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String searchWholesaler = wholesaler.trim();
        List<Medicine> allExpired = medicineRepository.findExpiredMedicines(LocalDate.now());
        List<ExpiredStockoutItem> result = new ArrayList<>();

        for (Medicine medicine : allExpired) {
            if (medicine.getStockLevel() <= 0 || !medicine.isActive()) {
                continue;
            }

            // Search if this expired batch has a purchase invoice from the selected wholesaler
            List<PurchaseBillItem> pbiList = purchaseBillRepository.findPurchaseBillItemsForStockout(
                    medicine.getSku(),
                    medicine.getBatchNumber(),
                    searchWholesaler
            );

            if (pbiList != null && !pbiList.isEmpty()) {
                PurchaseBillItem pbi = pbiList.get(0);
                PurchaseBill pb = pbi.getPurchaseBill();

                ExpiredStockoutItem item = new ExpiredStockoutItem(
                        medicine.getId(),
                        medicine.getName(),
                        medicine.getGenericName(),
                        medicine.getSku(),
                        medicine.getBatchNumber(),
                        medicine.getExpiryDate(),
                        medicine.getStockLevel(),
                        medicine.getCostPrice(),
                        medicine.getSellingPrice(),
                        medicine.getRackLocation(),
                        pb.getInvoiceNumber(),
                        pb.getInvoiceDate()
                );
                result.add(item);
            }
        }

        return ResponseEntity.ok(result);
    }

    public static class ExpiredStockoutItem {
        private Long medicineId;
        private String name;
        private String genericName;
        private String sku;
        private String batchNumber;
        private LocalDate expiryDate;
        private Integer stockLevel;
        private Double costPrice;
        private Double sellingPrice;
        private String rackLocation;
        private String invoiceNumber;
        private LocalDate invoiceDate;

        public ExpiredStockoutItem() {}

        public ExpiredStockoutItem(Long medicineId, String name, String genericName, String sku, String batchNumber,
                                   LocalDate expiryDate, Integer stockLevel, Double costPrice, Double sellingPrice,
                                   String rackLocation, String invoiceNumber, LocalDate invoiceDate) {
            this.medicineId = medicineId;
            this.name = name;
            this.genericName = genericName;
            this.sku = sku;
            this.batchNumber = batchNumber;
            this.expiryDate = expiryDate;
            this.stockLevel = stockLevel;
            this.costPrice = costPrice;
            this.sellingPrice = sellingPrice;
            this.rackLocation = rackLocation;
            this.invoiceNumber = invoiceNumber;
            this.invoiceDate = invoiceDate;
        }

        // Getters and Setters
        public Long getMedicineId() { return medicineId; }
        public void setMedicineId(Long medicineId) { this.medicineId = medicineId; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getGenericName() { return genericName; }
        public void setGenericName(String genericName) { this.genericName = genericName; }

        public String getSku() { return sku; }
        public void setSku(String sku) { this.sku = sku; }

        public String getBatchNumber() { return batchNumber; }
        public void setBatchNumber(String batchNumber) { this.batchNumber = batchNumber; }

        public LocalDate getExpiryDate() { return expiryDate; }
        public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }

        public Integer getStockLevel() { return stockLevel; }
        public void setStockLevel(Integer stockLevel) { this.stockLevel = stockLevel; }

        public Double getCostPrice() { return costPrice; }
        public void setCostPrice(Double costPrice) { this.costPrice = costPrice; }

        public Double getSellingPrice() { return sellingPrice; }
        public void setSellingPrice(Double sellingPrice) { this.sellingPrice = sellingPrice; }

        public String getRackLocation() { return rackLocation; }
        public void setRackLocation(String rackLocation) { this.rackLocation = rackLocation; }

        public String getInvoiceNumber() { return invoiceNumber; }
        public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

        public LocalDate getInvoiceDate() { return invoiceDate; }
        public void setInvoiceDate(LocalDate invoiceDate) { this.invoiceDate = invoiceDate; }
    }
}
