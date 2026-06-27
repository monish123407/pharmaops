package com.pharmacy.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "medicine_masters")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MedicineMaster {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String productName;

    @Column(nullable = false)
    private String composition; // active ingredients

    @Column(unique = true, nullable = false)
    private String productCode; // SKU or barcode

    @Column(nullable = false)
    private String companyName; // Manufacturer name

    @Column(nullable = false)
    private String category; // food, cosmetics, medicine, others

    @Column(nullable = false)
    private String productType; // Tablet, Syrup, Injection, Ointment, etc.

    @Column(nullable = false)
    private String productQuantity; // e.g. "10 tabs/strip" or "100ml bottle"

    @Column(nullable = false)
    private String hsnCode; // Indian HSN Code

    @Column(nullable = false)
    private Double cgst; // Central GST

    @Column(nullable = false)
    private Double sgst; // State GST

    @Builder.Default
    private Boolean active = true;
    
    @Column(nullable = true)
    private String rackLocation;

    @Column(nullable = true)
    private Integer reorderLevel;

    public boolean isActive() {
        return active != null && active;
    }

    @PrePersist
    protected void onCreate() {
        if (active == null) {
            active = true;
        }
    }
}
