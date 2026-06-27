package com.pharmacy.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GstHsnSummary {
    private String hsnCode;
    private Double gstRate;
    private String description;

    // Outward (Sales)
    private Double salesTaxable;
    private Double salesCgst;
    private Double salesSgst;

    // Inward (Purchases)
    private Double purchasesTaxable;
    private Double purchasesCgst;
    private Double purchasesSgst;
}
