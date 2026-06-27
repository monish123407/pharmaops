package com.pharmacy.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GstReportSummary {
    private Double totalSalesGross;        // Sum of all sales finalAmount + discountAmount
    private Double totalSalesDiscount;     // Sum of all sales discountAmount
    private Double totalSalesTaxable;      // Sum of sales taxable amounts
    private Double totalSalesGst;          // Sum of sales GST amounts (CGST + SGST)
    private Double totalSalesCgst;         // totalSalesGst / 2
    private Double totalSalesSgst;         // totalSalesGst / 2

    private Double totalPurchasesGross;    // Sum of all purchase bills grossAmount
    private Double totalPurchasesDiscount; // Sum of all purchase bills discountAmount
    private Double totalPurchasesTaxable;  // Sum of purchase bills taxableAmount (gross - discount)
    private Double totalPurchasesGst;      // Sum of purchase bills cgstAmount + sgstAmount
    private Double totalPurchasesCgst;     // Sum of purchase bills cgstAmount
    private Double totalPurchasesSgst;     // Sum of purchase bills sgstAmount

    private Double netGstPayable;          // totalSalesGst - totalPurchasesGst
    private Double netCgstPayable;         // totalSalesCgst - totalPurchasesCgst
    private Double netSgstPayable;         // totalSalesSgst - totalPurchasesSgst

    private List<GstSlabSummary> slabs;
    private List<GstHsnSummary> hsns;
    private List<GstTransactionDetail> salesTransactions;
    private List<GstTransactionDetail> purchaseTransactions;
}
