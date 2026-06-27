package com.pharmacy.backend.dto;

import lombok.Data;

@Data
public class CheckoutItem {
    private Long medicineId;
    private Integer quantity;
    private Double discountPercentage;
}
