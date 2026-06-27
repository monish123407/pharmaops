package com.pharmacy.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import com.fasterxml.jackson.annotation.JsonBackReference;

@Entity
@Table(name = "purchase_bill_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PurchaseBillItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String productName;

    @Column(nullable = false)
    private String productCode; // SKU reference from MedicineMaster

    @Column(nullable = false)
    private Integer quantity; // packs bought

    @Column(nullable = false)
    @Builder.Default
    private Integer loose = 0; // loose units

    @Column(nullable = false)
    private String batchNumber; // batch code

    @Column(nullable = true)
    private Integer reorderLevel;

    @Column(nullable = true)
    private String rackLocation;

    @Column(nullable = false)
    private String hsnCode; // Indian HSN Code

    @Column(nullable = false)
    private LocalDate expiryDate; // expiration

    @Column(nullable = false)
    private Double mrp; // Maximum Retail Price (selling price)

    @Column(nullable = false)
    private Double rate; // Purchase rate (cost price)

    @Column(nullable = false)
    private Double total; // rate * quantity

    @Column(nullable = false)
    @Builder.Default
    private Double discountPercentage = 0.0;

    @Column(nullable = false)
    private Double taxableAmount; // total - discount

    @Column(nullable = false)
    private Double cgstRate;

    @Column(nullable = false)
    private Double sgstRate;

    @Column(nullable = false)
    private Double cgstAmount;

    @Column(nullable = false)
    private Double sgstAmount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_bill_id", nullable = false)
    @JsonBackReference
    private PurchaseBill purchaseBill;
}
