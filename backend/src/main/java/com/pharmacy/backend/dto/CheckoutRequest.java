package com.pharmacy.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class CheckoutRequest {
    private String customerName;
    private String patientPhone;
    private String doctorName;
    private String patientAddress;
    private Double discountAmount;
    private Double taxAmount;
    private String paymentMethod;
    private String cashierName;
    private Long prescriptionId;
    private List<CheckoutItem> items;
}
