package com.pharmacy.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GstSlabSummary {
    private Double gstRate;
    
    // Outward (Sales)
    private Double salesTaxable;
    private Double salesCgst;
    private Double salesSgst;
    private Double salesTotalGst;

    // Inward (Purchases)
    private Double purchasesTaxable;
    private Double purchasesCgst;
    private Double purchasesSgst;
    private Double purchasesTotalGst;

    // Net Payable/Credit
    private Double netCgst;
    private Double netSgst;
    private Double netTotalGst;
}
