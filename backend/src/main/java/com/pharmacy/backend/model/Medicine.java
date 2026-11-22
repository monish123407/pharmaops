package com.pharmacy.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Entity
@Table(name = "medicines")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Medicine {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String genericName;

    @Column(nullable = false)
    private String sku;

    private String batchNumber;

    @Column(nullable = false)
    private LocalDate expiryDate;

    @Column(nullable = false)
    private Integer stockLevel;

    @Column(nullable = false)
    private Integer reorderLevel;

    @Column(nullable = false)
    private Double costPrice;

    @Column(nullable = false)
    private Double sellingPrice;

    private String manufacturer;

    private String rackLocation;

    @Builder.Default
    private String hsnCode = "3004";

    @Builder.Default
    private Double gstRate = 12.0; // Indian GST Slab: 0%, 5%, 12%, 18%, 28%

    @Builder.Default
    private Boolean active = true;

    @Builder.Default
    private LocalDate purchaseDate = LocalDate.now();

    public boolean isActive() {
        return active != null && active;
    }

    @PrePersist
    protected void onCreate() {
        if (active == null) {
            active = true;
        }
        if (purchaseDate == null) {
            purchaseDate = LocalDate.now();
        }
    }
}
