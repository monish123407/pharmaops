package com.pharmacy.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GstTransactionDetail {
    private String transactionNumber; // INV-xxx or PB-xxx
    private String referenceNumber;   // Supplier's Bill Inv No
    private LocalDateTime date;
    private String partyName;        // customerName or supplierName
    private String gstin;            // supplier's GSTIN or N/A
    private Double grossAmount;
    private Double discountAmount;
    private Double taxableAmount;
    private Double cgstAmount;
    private Double sgstAmount;
    private Double totalGst;
    private Double finalAmount;
}
