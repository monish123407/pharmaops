package com.pharmacy.backend.controller;

import com.pharmacy.backend.dto.*;
import com.pharmacy.backend.model.*;
import com.pharmacy.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/gst")
public class GstReportController {

    @Autowired
    private SaleRepository saleRepository;

    @Autowired
    private PurchaseBillRepository purchaseBillRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @GetMapping("/summary")
    public GstReportSummary getGstSummary(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        // 1. Parse Dates safely
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

        // 2. Fetch Base Sales and active Purchase Invoices
        List<Sale> sales = saleRepository.findSalesBetween(startDateTime, endDateTime);
        List<PurchaseBill> purchases = purchaseBillRepository.findPurchaseBillsBetween(startDateTime, endDateTime);

        // Map supplier names to GSTIN safely
        Map<String, String> supplierGstnMap = new HashMap<>();
        try {
            supplierGstnMap = supplierRepository.findAll().stream()
                    .filter(s -> s != null && s.isActive() && s.getName() != null)
                    .collect(Collectors.toMap(
                            s -> s.getName().trim().toLowerCase(),
                            s -> s.getGstn() != null ? s.getGstn() : "N/A",
                            (gstn1, gstn2) -> gstn1
                    ));
        } catch (Exception e) {
            // fallback
        }

        // 3. Initialize Slabs Accumulator Map safely
        List<Double> standardSlabs = Arrays.asList(0.0, 5.0, 12.0, 18.0, 28.0);
        Map<Double, GstSlabSummary> slabsMap = new LinkedHashMap<>();
        for (Double rate : standardSlabs) {
            slabsMap.put(rate, GstSlabSummary.builder()
                    .gstRate(rate)
                    .salesTaxable(0.0)
                    .salesCgst(0.0)
                    .salesSgst(0.0)
                    .salesTotalGst(0.0)
                    .purchasesTaxable(0.0)
                    .purchasesCgst(0.0)
                    .purchasesSgst(0.0)
                    .purchasesTotalGst(0.0)
                    .netCgst(0.0)
                    .netSgst(0.0)
                    .netTotalGst(0.0)
                    .build());
        }

        // 4. Initialize HSN Accumulator Map
        Map<String, GstHsnSummary> hsnsMap = new TreeMap<>();

        // 5. Initialize Header Totals
        double totalSalesGross = 0.0;
        double totalSalesDiscount = 0.0;
        double totalSalesTaxable = 0.0;
        double totalSalesGst = 0.0;

        List<GstTransactionDetail> salesDetails = new ArrayList<>();

        // 6. Process Outward Sales
        for (Sale sale : sales) {
            if (sale == null) continue;
            
            double grossVal = sale.getTotalAmount() != null ? sale.getTotalAmount() : 0.0;
            double discVal = sale.getDiscountAmount() != null ? sale.getDiscountAmount() : 0.0;
            double finalVal = sale.getFinalAmount() != null ? sale.getFinalAmount() : 0.0;

            totalSalesGross += grossVal;
            totalSalesDiscount += discVal;

            double saleTaxableAcc = 0.0;
            double saleGstAcc = 0.0;

            double totalUndiscounted = 0.0;
            if (sale.getItems() != null) {
                totalUndiscounted = sale.getItems().stream()
                        .filter(Objects::nonNull)
                        .mapToDouble(i -> i.getSubtotal() != null ? i.getSubtotal() : 0.0)
                        .sum();
            }

            if (sale.getItems() != null) {
                for (SaleItem item : sale.getItems()) {
                    if (item == null) continue;

                    double itemSubtotal = item.getSubtotal() != null ? item.getSubtotal() : 0.0;
                    double itemDiscount = totalUndiscounted > 0.0 ? (itemSubtotal / totalUndiscounted) * discVal : 0.0;
                    double itemNet = Math.max(0.0, itemSubtotal - itemDiscount);

                    double rate = item.getGstRate() != null ? item.getGstRate() : 12.0;
                    double taxable = itemNet / (1.0 + rate / 100.0);
                    double gst = itemNet - taxable;
                    double cgst = gst / 2.0;
                    double sgst = gst / 2.0;

                    saleTaxableAcc += taxable;
                    saleGstAcc += gst;

                    // Accumulate Slabs safely
                    GstSlabSummary slab = slabsMap.computeIfAbsent(rate, r -> GstSlabSummary.builder()
                            .gstRate(r)
                            .salesTaxable(0.0)
                            .salesCgst(0.0)
                            .salesSgst(0.0)
                            .salesTotalGst(0.0)
                            .purchasesTaxable(0.0)
                            .purchasesCgst(0.0)
                            .purchasesSgst(0.0)
                            .purchasesTotalGst(0.0)
                            .netCgst(0.0)
                            .netSgst(0.0)
                            .netTotalGst(0.0)
                            .build());
                    slab.setSalesTaxable(slab.getSalesTaxable() + taxable);
                    slab.setSalesCgst(slab.getSalesCgst() + cgst);
                    slab.setSalesSgst(slab.getSalesSgst() + sgst);
                    slab.setSalesTotalGst(slab.getSalesTotalGst() + gst);

                    // Accumulate HSN summaries safely
                    String hsn = item.getHsnCode() != null && !item.getHsnCode().trim().isEmpty() 
                            ? item.getHsnCode().trim() : "3004";
                    String key = hsn + "-" + rate;
                    GstHsnSummary hsnSummary = hsnsMap.computeIfAbsent(key, k -> GstHsnSummary.builder()
                            .hsnCode(hsn)
                            .gstRate(rate)
                            .description(rate == 5.0 ? "Life-saving Drugs" : rate == 12.0 ? "Standard Formulations" : "Other medical items")
                            .salesTaxable(0.0)
                            .salesCgst(0.0)
                            .salesSgst(0.0)
                            .purchasesTaxable(0.0)
                            .purchasesCgst(0.0)
                            .purchasesSgst(0.0)
                            .build());
                    hsnSummary.setSalesTaxable(hsnSummary.getSalesTaxable() + taxable);
                    hsnSummary.setSalesCgst(hsnSummary.getSalesCgst() + cgst);
                    hsnSummary.setSalesSgst(hsnSummary.getSalesSgst() + sgst);
                }
            }

            totalSalesTaxable += saleTaxableAcc;
            totalSalesGst += saleGstAcc;

            salesDetails.add(GstTransactionDetail.builder()
                    .transactionNumber(sale.getInvoiceNumber())
                    .referenceNumber("N/A")
                    .date(sale.getSaleDate())
                    .partyName(sale.getCustomerName() != null ? sale.getCustomerName() : "Walk-in Customer")
                    .gstin("N/A")
                    .grossAmount(grossVal)
                    .discountAmount(discVal)
                    .taxableAmount(saleTaxableAcc)
                    .cgstAmount(saleGstAcc / 2.0)
                    .sgstAmount(saleGstAcc / 2.0)
                    .totalGst(saleGstAcc)
                    .finalAmount(finalVal)
                    .build());
        }

        // 7. Process Inward Purchases safely
        double totalPurchasesGross = 0.0;
        double totalPurchasesDiscount = 0.0;
        double totalPurchasesTaxable = 0.0;
        double totalPurchasesGst = 0.0;
        double totalPurchasesCgst = 0.0;
        double totalPurchasesSgst = 0.0;

        List<GstTransactionDetail> purchasesDetails = new ArrayList<>();

        for (PurchaseBill pb : purchases) {
            if (pb == null) continue;
            
            double grossVal = pb.getGrossAmount() != null ? pb.getGrossAmount() : 0.0;
            double discVal = pb.getDiscountAmount() != null ? pb.getDiscountAmount() : 0.0;
            double cgstVal = pb.getCgstAmount() != null ? pb.getCgstAmount() : 0.0;
            double sgstVal = pb.getSgstAmount() != null ? pb.getSgstAmount() : 0.0;
            double finalVal = pb.getTotalAmount() != null ? pb.getTotalAmount() : 0.0;

            totalPurchasesGross += grossVal;
            totalPurchasesDiscount += discVal;
            totalPurchasesTaxable += (grossVal - discVal);
            totalPurchasesGst += (cgstVal + sgstVal);
            totalPurchasesCgst += cgstVal;
            totalPurchasesSgst += sgstVal;

            String supplierNameClean = pb.getSupplierName() != null ? pb.getSupplierName().trim().toLowerCase() : "";
            String gstinLookup = supplierGstnMap.getOrDefault(supplierNameClean, "N/A");

            if (pb.getItems() != null) {
                for (PurchaseBillItem item : pb.getItems()) {
                    if (item == null) continue;

                    double cgstRateVal = item.getCgstRate() != null ? item.getCgstRate() : 6.0;
                    double sgstRateVal = item.getSgstRate() != null ? item.getSgstRate() : 6.0;
                    double rate = cgstRateVal + sgstRateVal;
                    
                    double taxable = item.getTaxableAmount() != null ? item.getTaxableAmount() : 0.0;
                    double cgst = item.getCgstAmount() != null ? item.getCgstAmount() : 0.0;
                    double sgst = item.getSgstAmount() != null ? item.getSgstAmount() : 0.0;
                    double gst = cgst + sgst;

                    // Accumulate Slabs safely
                    GstSlabSummary slab = slabsMap.computeIfAbsent(rate, r -> GstSlabSummary.builder()
                            .gstRate(r)
                            .salesTaxable(0.0)
                            .salesCgst(0.0)
                            .salesSgst(0.0)
                            .salesTotalGst(0.0)
                            .purchasesTaxable(0.0)
                            .purchasesCgst(0.0)
                            .purchasesSgst(0.0)
                            .purchasesTotalGst(0.0)
                            .netCgst(0.0)
                            .netSgst(0.0)
                            .netTotalGst(0.0)
                            .build());
                    slab.setPurchasesTaxable(slab.getPurchasesTaxable() + taxable);
                    slab.setPurchasesCgst(slab.getPurchasesCgst() + cgst);
                    slab.setPurchasesSgst(slab.getPurchasesSgst() + sgst);
                    slab.setPurchasesTotalGst(slab.getPurchasesTotalGst() + gst);

                    // Accumulate HSN summaries safely
                    String hsn = item.getHsnCode() != null && !item.getHsnCode().trim().isEmpty() 
                            ? item.getHsnCode().trim() : "3004";
                    String key = hsn + "-" + rate;
                    GstHsnSummary hsnSummary = hsnsMap.computeIfAbsent(key, k -> GstHsnSummary.builder()
                            .hsnCode(hsn)
                            .gstRate(rate)
                            .description(rate == 5.0 ? "Life-saving Drugs" : rate == 12.0 ? "Standard Formulations" : "Other medical items")
                            .salesTaxable(0.0)
                            .salesCgst(0.0)
                            .salesSgst(0.0)
                            .purchasesTaxable(0.0)
                            .purchasesCgst(0.0)
                            .purchasesSgst(0.0)
                            .build());
                    hsnSummary.setPurchasesTaxable(hsnSummary.getPurchasesTaxable() + taxable);
                    hsnSummary.setPurchasesCgst(hsnSummary.getPurchasesCgst() + cgst);
                    hsnSummary.setPurchasesSgst(hsnSummary.getPurchasesSgst() + sgst);
                }
            }

            purchasesDetails.add(GstTransactionDetail.builder()
                    .transactionNumber(pb.getBillNumber())
                    .referenceNumber(pb.getInvoiceNumber())
                    .date(pb.getPurchaseDate())
                    .partyName(pb.getSupplierName() != null ? pb.getSupplierName() : "Unknown Wholesaler")
                    .gstin(gstinLookup)
                    .grossAmount(grossVal)
                    .discountAmount(discVal)
                    .taxableAmount(grossVal - discVal)
                    .cgstAmount(cgstVal)
                    .sgstAmount(sgstVal)
                    .totalGst(cgstVal + sgstVal)
                    .finalAmount(finalVal)
                    .build());
        }

        // 8. Re-evaluate Slab Net figures
        for (GstSlabSummary slab : slabsMap.values()) {
            slab.setNetCgst(slab.getSalesCgst() - slab.getPurchasesCgst());
            slab.setNetSgst(slab.getSalesSgst() - slab.getPurchasesSgst());
            slab.setNetTotalGst(slab.getSalesTotalGst() - slab.getPurchasesTotalGst());
        }

        // Chronological sorting safely (newest first)
        salesDetails.sort((a, b) -> {
            if (a.getDate() == null && b.getDate() == null) return 0;
            if (a.getDate() == null) return 1;
            if (b.getDate() == null) return -1;
            return b.getDate().compareTo(a.getDate());
        });
        purchasesDetails.sort((a, b) -> {
            if (a.getDate() == null && b.getDate() == null) return 0;
            if (a.getDate() == null) return 1;
            if (b.getDate() == null) return -1;
            return b.getDate().compareTo(a.getDate());
        });

        double totalSalesCgst = totalSalesGst / 2.0;
        double totalSalesSgst = totalSalesGst / 2.0;

        return GstReportSummary.builder()
                .totalSalesGross(totalSalesGross)
                .totalSalesDiscount(totalSalesDiscount)
                .totalSalesTaxable(totalSalesTaxable)
                .totalSalesGst(totalSalesGst)
                .totalSalesCgst(totalSalesCgst)
                .totalSalesSgst(totalSalesSgst)
                
                .totalPurchasesGross(totalPurchasesGross)
                .totalPurchasesDiscount(totalPurchasesDiscount)
                .totalPurchasesTaxable(totalPurchasesTaxable)
                .totalPurchasesGst(totalPurchasesGst)
                .totalPurchasesCgst(totalPurchasesCgst)
                .totalPurchasesSgst(totalPurchasesSgst)
                
                .netGstPayable(totalSalesGst - totalPurchasesGst)
                .netCgstPayable(totalSalesCgst - totalPurchasesCgst)
                .netSgstPayable(totalSalesSgst - totalPurchasesSgst)
                
                .slabs(new ArrayList<>(slabsMap.values()))
                .hsns(new ArrayList<>(hsnsMap.values()))
                .salesTransactions(salesDetails)
                .purchaseTransactions(purchasesDetails)
                .build();
    }
}
