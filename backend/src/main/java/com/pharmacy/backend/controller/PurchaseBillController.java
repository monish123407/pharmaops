package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.Medicine;
import com.pharmacy.backend.model.MedicineMaster;
import com.pharmacy.backend.model.PurchaseBill;
import com.pharmacy.backend.model.PurchaseBillItem;
import com.pharmacy.backend.repository.MedicineRepository;
import com.pharmacy.backend.repository.MedicineMasterRepository;
import com.pharmacy.backend.repository.PurchaseBillRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/purchase-bills")
public class PurchaseBillController {

    @Autowired
    private PurchaseBillRepository purchaseBillRepository;

    @Autowired
    private MedicineRepository medicineRepository;

    @Autowired
    private MedicineMasterRepository medicineMasterRepository;

    @GetMapping
    public List<PurchaseBill> getAllPurchaseBills() {
        return purchaseBillRepository.findByActiveTrueOrderByPurchaseDateDesc();
    }

    @GetMapping("/{id}")
    public ResponseEntity<PurchaseBill> getPurchaseBillById(@PathVariable Long id) {
        Optional<PurchaseBill> bill = purchaseBillRepository.findById(id);
        return bill.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<PurchaseBill> createPurchaseBill(@RequestBody PurchaseBill purchaseBill) {
        if (purchaseBill.getItems() == null || purchaseBill.getItems().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        // 1. Generate unique generated Bill No and Token Number
        String generatedBillNo = "PB-" + System.currentTimeMillis();
        purchaseBill.setBillNumber(generatedBillNo);
        if (purchaseBill.getTotalAmount() != null) {
            purchaseBill.setTotalAmount((double) Math.round(purchaseBill.getTotalAmount()));
        }
        
        LocalDateTime purchaseDateTime = LocalDateTime.now();
        purchaseBill.setPurchaseDate(purchaseDateTime);

        // Calculate next Token Number based on Financial Year resetting (April 1st)
        int currentYear = purchaseDateTime.getYear();
        int currentMonth = purchaseDateTime.getMonthValue();
        LocalDateTime financialYearStart;
        
        if (currentMonth >= 4) {
            // Current Financial Year started on April 1st of Y
            financialYearStart = LocalDateTime.of(currentYear, 4, 1, 0, 0, 0);
        } else {
            // Current Financial Year started on April 1st of Y-1
            financialYearStart = LocalDateTime.of(currentYear - 1, 4, 1, 0, 0, 0);
        }
        
        Integer maxToken = purchaseBillRepository.findMaxTokenNumberSince(financialYearStart);
        int nextToken = (maxToken != null) ? maxToken + 1 : 1;
        purchaseBill.setTokenNumber(nextToken);

        // 2. Set relationship bindings
        for (PurchaseBillItem item : purchaseBill.getItems()) {
            item.setPurchaseBill(purchaseBill);
        }

        // 3. Save purchase bill and its items transaction logs
        PurchaseBill savedBill = purchaseBillRepository.save(purchaseBill);

        // 4. Update or Add items in Active Stock inventory
        for (PurchaseBillItem item : savedBill.getItems()) {
            // Lookup master details to get pack size, composition, manufacturer
            Optional<MedicineMaster> masterOpt = medicineMasterRepository.findFirstByProductCodeAndActiveTrue(
                    item.getProductCode()
            );
            int packSize = 10; // default fallback
            String composition = item.getProductName();
            String manufacturer = "Unknown";
            String category = "medicine";
            boolean isTabletOrCapsule = true;

            if (masterOpt.isPresent()) {
                MedicineMaster master = masterOpt.get();
                String pType = master.getProductType() != null ? master.getProductType().toLowerCase() : "";
                isTabletOrCapsule = pType.contains("tablet") || pType.contains("capsule");
                packSize = isTabletOrCapsule ? parsePackSize(master.getProductQuantity()) : 1;
                composition = master.getComposition();
                manufacturer = master.getCompanyName();
                category = master.getCategory();
            }

            int totalUnits = isTabletOrCapsule 
                ? (item.getQuantity() + item.getLoose()) * packSize 
                : (item.getQuantity() + item.getLoose());

            // Check if exact batch of SKU already exists in active stock
            Optional<Medicine> existingStock = medicineRepository.findFirstBySkuAndBatchNumberAndActiveTrue(
                    item.getProductCode(), item.getBatchNumber()
            );



            if (existingStock.isPresent()) {
                // Increment stock level, update cost/mrp/expiry
                Medicine medicine = existingStock.get();
                medicine.setStockLevel(medicine.getStockLevel() + totalUnits);
                medicine.setCostPrice(item.getRate());
                medicine.setSellingPrice(item.getMrp());
                medicine.setExpiryDate(item.getExpiryDate());
                medicine.setBatchNumber(item.getBatchNumber());
                medicine.setHsnCode(item.getHsnCode());
                medicine.setGstRate(item.getCgstRate() + item.getSgstRate());
                if (item.getReorderLevel() != null) {
                    // reorderLevel entered as strips → convert to tablets for storage
                    medicine.setReorderLevel(isTabletOrCapsule
                        ? item.getReorderLevel() * packSize
                        : item.getReorderLevel());
                }
                if (item.getRackLocation() != null && !item.getRackLocation().trim().isEmpty()) {
                    medicine.setRackLocation(item.getRackLocation());
                }
                medicineRepository.save(medicine);
            } else {
                // Create a completely new medicine row inside stock
                Medicine newStock = Medicine.builder()
                        .name(item.getProductName())
                        .genericName(composition)
                        .sku(item.getProductCode())
                        .batchNumber(item.getBatchNumber())
                        .expiryDate(item.getExpiryDate())
                        .stockLevel(totalUnits)
                        .reorderLevel(item.getReorderLevel() != null
                                ? (isTabletOrCapsule
                                    ? item.getReorderLevel() * packSize
                                    : item.getReorderLevel())
                                : (isTabletOrCapsule ? packSize * 10 : 10))
                        .costPrice(item.getRate())
                        .sellingPrice(item.getMrp())
                        .manufacturer(manufacturer)
                        .rackLocation(item.getRackLocation() != null && !item.getRackLocation().trim().isEmpty() 
                                ? item.getRackLocation() 
                                : (category.equalsIgnoreCase("cosmetics") ? "Rack-B" : "Rack-A"))
                        .hsnCode(item.getHsnCode())
                        .gstRate(item.getCgstRate() + item.getSgstRate())
                        .active(true)
                        .build();

                medicineRepository.save(newStock);
            }
        }

        return ResponseEntity.ok(savedBill);
    }

    @PutMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<PurchaseBill> updatePurchaseBill(@PathVariable Long id, @RequestBody PurchaseBill updatedBill) {
        Optional<PurchaseBill> existingBillOpt = purchaseBillRepository.findById(id);
        if (existingBillOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        PurchaseBill existingBill = existingBillOpt.get();

        // 1. Revert inventory stock levels of old items
        for (PurchaseBillItem oldItem : existingBill.getItems()) {
            Optional<MedicineMaster> masterOpt = medicineMasterRepository.findFirstByProductCodeAndActiveTrue(
                    oldItem.getProductCode()
            );
            int packSize = 10;
            boolean isTabletOrCapsule = true;
            if (masterOpt.isPresent()) {
                MedicineMaster master = masterOpt.get();
                String pType = master.getProductType() != null ? master.getProductType().toLowerCase() : "";
                isTabletOrCapsule = pType.contains("tablet") || pType.contains("capsule");
                packSize = isTabletOrCapsule ? parsePackSize(master.getProductQuantity()) : 1;
            }
            int totalUnits = isTabletOrCapsule 
                ? (oldItem.getQuantity() + oldItem.getLoose()) * packSize 
                : (oldItem.getQuantity() + oldItem.getLoose());

            Optional<Medicine> stockOpt = medicineRepository.findFirstBySkuAndBatchNumberAndActiveTrue(
                    oldItem.getProductCode(), oldItem.getBatchNumber()
            );
            if (stockOpt.isEmpty()) {
                stockOpt = medicineRepository.findFirstBySkuAndActiveTrue(oldItem.getProductCode());
            }

            if (stockOpt.isPresent()) {
                Medicine stock = stockOpt.get();
                int newStockLevel = stock.getStockLevel() - totalUnits;
                stock.setStockLevel(Math.max(0, newStockLevel)); // Option A: clip at 0
                medicineRepository.save(stock);
            }
        }

        // 2. Clear old items and update header attributes
        existingBill.getItems().clear();
        existingBill.setInvoiceNumber(updatedBill.getInvoiceNumber());
        existingBill.setInvoiceDate(updatedBill.getInvoiceDate());
        existingBill.setSupplierName(updatedBill.getSupplierName());
        existingBill.setNetAmount(updatedBill.getNetAmount());
        existingBill.setGrossAmount(updatedBill.getGrossAmount());
        existingBill.setDiscountAmount(updatedBill.getDiscountAmount());
        existingBill.setCgstAmount(updatedBill.getCgstAmount());
        existingBill.setSgstAmount(updatedBill.getSgstAmount());
        if (updatedBill.getTotalAmount() != null) {
            existingBill.setTotalAmount((double) Math.round(updatedBill.getTotalAmount()));
        } else {
            existingBill.setTotalAmount(0.0);
        }

        // 3. Bind and apply new items
        for (PurchaseBillItem newItem : updatedBill.getItems()) {
            newItem.setId(null); // Force fresh persist to avoid JPA detached entity exceptions
            newItem.setPurchaseBill(existingBill);
            existingBill.getItems().add(newItem);

            Optional<MedicineMaster> masterOpt = medicineMasterRepository.findFirstByProductCodeAndActiveTrue(
                    newItem.getProductCode()
            );
            int packSize = 10;
            String composition = newItem.getProductName();
            String manufacturer = "Unknown";
            String category = "medicine";
            boolean isTabletOrCapsule = true;

            if (masterOpt.isPresent()) {
                MedicineMaster master = masterOpt.get();
                String pType = master.getProductType() != null ? master.getProductType().toLowerCase() : "";
                isTabletOrCapsule = pType.contains("tablet") || pType.contains("capsule");
                packSize = isTabletOrCapsule ? parsePackSize(master.getProductQuantity()) : 1;
                composition = master.getComposition();
                manufacturer = master.getCompanyName();
                category = master.getCategory();
            }

            int totalUnits = isTabletOrCapsule 
                ? (newItem.getQuantity() + newItem.getLoose()) * packSize 
                : (newItem.getQuantity() + newItem.getLoose());

            // Reconcile/increment active stock with new item quantities
            Optional<Medicine> stockOpt = medicineRepository.findFirstBySkuAndBatchNumberAndActiveTrue(
                    newItem.getProductCode(), newItem.getBatchNumber()
            );


            if (stockOpt.isPresent()) {
                Medicine stock = stockOpt.get();
                stock.setStockLevel(stock.getStockLevel() + totalUnits);
                stock.setCostPrice(newItem.getRate());
                stock.setSellingPrice(newItem.getMrp());
                stock.setExpiryDate(newItem.getExpiryDate());
                stock.setBatchNumber(newItem.getBatchNumber());
                stock.setHsnCode(newItem.getHsnCode());
                stock.setGstRate(newItem.getCgstRate() + newItem.getSgstRate());
                if (newItem.getReorderLevel() != null) {
                    // reorderLevel entered as strips → convert to tablets for storage
                    stock.setReorderLevel(isTabletOrCapsule
                        ? newItem.getReorderLevel() * packSize
                        : newItem.getReorderLevel());
                }
                if (newItem.getRackLocation() != null && !newItem.getRackLocation().trim().isEmpty()) {
                    stock.setRackLocation(newItem.getRackLocation());
                }
                medicineRepository.save(stock);
            } else {
                // Register a new batch/medicine row inside active stock
                Medicine newStock = Medicine.builder()
                        .name(newItem.getProductName())
                        .genericName(composition)
                        .sku(newItem.getProductCode())
                        .batchNumber(newItem.getBatchNumber())
                        .expiryDate(newItem.getExpiryDate())
                        .stockLevel(totalUnits)
                        .reorderLevel(newItem.getReorderLevel() != null
                                ? (isTabletOrCapsule
                                    ? newItem.getReorderLevel() * packSize
                                    : newItem.getReorderLevel())
                                : (isTabletOrCapsule ? packSize * 10 : 10))
                        .costPrice(newItem.getRate())
                        .sellingPrice(newItem.getMrp())
                        .manufacturer(manufacturer)
                        .rackLocation(newItem.getRackLocation() != null && !newItem.getRackLocation().trim().isEmpty() 
                                ? newItem.getRackLocation() 
                                : (category.equalsIgnoreCase("cosmetics") ? "Rack-B" : "Rack-A"))
                        .hsnCode(newItem.getHsnCode())
                        .gstRate(newItem.getCgstRate() + newItem.getSgstRate())
                        .active(true)
                        .build();

                medicineRepository.save(newStock);
            }
        }

        PurchaseBill savedBill = purchaseBillRepository.save(existingBill);
        return ResponseEntity.ok(savedBill);
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
}
