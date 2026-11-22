package com.pharmacy.backend.controller;

import com.pharmacy.backend.dto.CheckoutItem;
import com.pharmacy.backend.dto.CheckoutRequest;
import com.pharmacy.backend.model.Customer;
import com.pharmacy.backend.model.Medicine;
import com.pharmacy.backend.model.Prescription;
import com.pharmacy.backend.model.Sale;
import com.pharmacy.backend.model.SaleItem;
import com.pharmacy.backend.repository.CustomerRepository;
import com.pharmacy.backend.repository.MedicineRepository;
import com.pharmacy.backend.repository.PrescriptionRepository;
import com.pharmacy.backend.repository.SaleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/sales")
public class SaleController {

    @Autowired
    private SaleRepository saleRepository;

    @Autowired
    private MedicineRepository medicineRepository;

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @Autowired
    private com.pharmacy.backend.repository.MedicineMasterRepository medicineMasterRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @GetMapping
    public List<Sale> getAllSales() {
        return saleRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Sale> getSaleById(@PathVariable Long id) {
        return saleRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createSale(@RequestBody CheckoutRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            return ResponseEntity.badRequest().body("Invoice must contain at least one item.");
        }

        // Auto-register new customer if phone number is provided and doesn't exist
        if (request.getPatientPhone() != null && !request.getPatientPhone().trim().isEmpty()) {
            String phone = request.getPatientPhone().trim();
            Optional<Customer> existingCustomer = customerRepository.findByPhoneAndActiveTrue(phone);
            if (existingCustomer.isEmpty()) {
                String custName = request.getCustomerName() != null && !request.getCustomerName().trim().isEmpty() 
                        ? request.getCustomerName().trim() : "Walk-in Customer";
                Customer newCustomer = Customer.builder()
                        .name(custName)
                        .phone(phone)
                        .address(request.getPatientAddress() != null && !request.getPatientAddress().trim().isEmpty() 
                                ? request.getPatientAddress().trim() : null)
                        .active(true)
                        .build();
                customerRepository.save(newCustomer);
            }
        }

        // 1. Generate unique invoice number
        String invoiceNumber = "INV-" + System.currentTimeMillis() / 1000;

        Sale sale = Sale.builder()
                .invoiceNumber(invoiceNumber)
                .saleDate(LocalDateTime.now())
                .customerName(request.getCustomerName() != null && !request.getCustomerName().trim().isEmpty() 
                        ? request.getCustomerName() : "Walk-in Customer")
                .patientPhone(request.getPatientPhone())
                .doctorName(request.getDoctorName())
                .patientAddress(request.getPatientAddress())
                .discountAmount(request.getDiscountAmount() != null ? request.getDiscountAmount() : 0.0)
                .taxAmount(request.getTaxAmount() != null ? request.getTaxAmount() : 0.0)
                .paymentMethod(request.getPaymentMethod() != null ? request.getPaymentMethod() : "Cash")
                .cashierName(request.getCashierName() != null ? request.getCashierName() : "Cashier")
                .prescriptionId(request.getPrescriptionId())
                .build();

        double totalAmount = 0.0;

        // 2. Process checkout items
        for (CheckoutItem checkoutItem : request.getItems()) {
            Optional<Medicine> medicineOpt = medicineRepository.findById(checkoutItem.getMedicineId());
            if (medicineOpt.isEmpty()) {
                return ResponseEntity.badRequest().body("Medicine with ID " + checkoutItem.getMedicineId() + " not found.");
            }

            Medicine medicine = medicineOpt.get();
            if (!medicine.isActive()) {
                return ResponseEntity.badRequest().body("Medicine " + medicine.getName() + " is inactive.");
            }

            if (medicine.getStockLevel() < checkoutItem.getQuantity()) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body("Insufficient stock for " + medicine.getName() + ". Available: " + medicine.getStockLevel());
            }

            // Deduct stock
            int newStock = medicine.getStockLevel() - checkoutItem.getQuantity();
            medicine.setStockLevel(newStock);

            if (newStock <= 0) {
                // Batch is fully consumed — remove it from active inventory
                medicineRepository.delete(medicine);
            } else {
                medicineRepository.save(medicine);
            }

            // Create SaleItem
            double singleSellingPrice = medicine.getSellingPrice();
            
            // Check if tablet or capsule
            java.util.Optional<com.pharmacy.backend.model.MedicineMaster> masterOpt = medicineMasterRepository.findFirstByProductCodeAndActiveTrue(medicine.getSku());
            if (masterOpt.isPresent()) {
                com.pharmacy.backend.model.MedicineMaster master = masterOpt.get();
                String type = master.getProductType() != null ? master.getProductType().toLowerCase() : "";
                if (type.contains("tablet") || type.contains("capsule")) {
                    // Parse pack size
                    int packSize = 10;
                    String qtyStr = master.getProductQuantity();
                    if (qtyStr != null) {
                        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\d+)").matcher(qtyStr);
                        if (matcher.find()) {
                            packSize = Integer.parseInt(matcher.group(1));
                        }
                    }
                    singleSellingPrice = medicine.getSellingPrice() / packSize;
                }
            }
            
            double itemSubtotal = singleSellingPrice * checkoutItem.getQuantity();
            totalAmount += itemSubtotal;

            SaleItem saleItem = SaleItem.builder()
                    .medicineId(medicine.getId())
                    .medicineName(medicine.getName())
                    .quantity(checkoutItem.getQuantity())
                    .unitPrice(singleSellingPrice)
                    .subtotal(itemSubtotal)
                    .hsnCode(medicine.getHsnCode())
                    .gstRate(medicine.getGstRate())
                    .batchNumber(medicine.getBatchNumber())
                    .expiryDate(medicine.getExpiryDate())
                    .discountPercentage(checkoutItem.getDiscountPercentage() != null ? checkoutItem.getDiscountPercentage() : 0.0)
                    .build();

            sale.addSaleItem(saleItem);
        }

        // Calculate and validate amounts (Selling Price is tax-inclusive MRP in Indian GST guidelines)
        sale.setTotalAmount(totalAmount);
        double finalAmount = totalAmount - sale.getDiscountAmount();
        sale.setFinalAmount((double) Math.floor(finalAmount));

        // 3. Mark Prescription as Dispensed if applicable
        if (request.getPrescriptionId() != null) {
            Optional<Prescription> prescriptionOpt = prescriptionRepository.findById(request.getPrescriptionId());
            if (prescriptionOpt.isPresent()) {
                Prescription prescription = prescriptionOpt.get();
                prescription.setStatus("DISPENSED");
                prescriptionRepository.save(prescription);
            }
        }

        // 4. Save and return Completed Sale Invoice
        Sale savedSale = saleRepository.save(sale);
        return ResponseEntity.ok(savedSale);
    }

    // ── Billing History endpoint ───────────────────────────────────────────
    @GetMapping("/history")
    public Map<String, Object> getHistory(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String paymentMethod) {

        LocalDate from = startDate != null ? startDate : LocalDate.now().withDayOfMonth(1);
        LocalDate to   = endDate   != null ? endDate   : LocalDate.now();

        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end   = to.atTime(23, 59, 59);

        String srch = (search != null && !search.isBlank()) ? search.trim() : null;
        String pay  = (paymentMethod != null && !paymentMethod.isBlank()
                       && !paymentMethod.equals("ALL")) ? paymentMethod : null;

        List<Sale> sales = saleRepository.searchSales(srch, pay, start, end);

        // Compute summary stats
        double totalRevenue   = sales.stream().mapToDouble(Sale::getFinalAmount).sum();
        double totalDiscount  = sales.stream().mapToDouble(Sale::getDiscountAmount).sum();
        double totalTax       = sales.stream().mapToDouble(Sale::getTaxAmount).sum();
        long   invoiceCount   = sales.size();

        // Payment method breakdown
        Map<String, Double> paymentBreakdown = new LinkedHashMap<>();
        for (Sale s : sales) {
            paymentBreakdown.merge(s.getPaymentMethod(), s.getFinalAmount(), Double::sum);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sales", sales);
        result.put("totalRevenue",  totalRevenue);
        result.put("totalDiscount", totalDiscount);
        result.put("totalTax",      totalTax);
        result.put("invoiceCount",  invoiceCount);
        result.put("paymentBreakdown", paymentBreakdown);
        result.put("startDate", from.toString());
        result.put("endDate",   to.toString());
        return result;
    }
}
