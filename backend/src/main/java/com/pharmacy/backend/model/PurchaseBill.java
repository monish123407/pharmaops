package com.pharmacy.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonManagedReference;

@Entity
@Table(name = "purchase_bills")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PurchaseBill {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String billNumber; // Mapped unique generated Bill No

    @Column(nullable = false)
    private String invoiceNumber; // User-entered wholesaler invoice reference

    @Column(nullable = true)
    private java.time.LocalDate invoiceDate; // Wholesaler invoice date

    @Column(nullable = true)
    private Integer tokenNumber; // Sequential token number reset on April 1st

    @Column(nullable = false)
    private String supplierName; // Wholesaler name

    @Column(nullable = false)
    private Double netAmount; // Wholesaler invoice net amount expected

    @Column(nullable = false)
    private Double grossAmount; // Calculated summation item totals before discount

    @Column(nullable = false)
    private Double discountAmount; // Calculated summation discounts

    @Column(nullable = false)
    private Double cgstAmount; // Calculated summation CGST

    @Column(nullable = false)
    private Double sgstAmount; // Calculated summation SGST

    @Column(nullable = false)
    private Double totalAmount; // Calculated final total amount

    @Builder.Default
    private LocalDateTime purchaseDate = LocalDateTime.now();

    @OneToMany(mappedBy = "purchaseBill", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JsonManagedReference
    @Builder.Default
    private List<PurchaseBillItem> items = new ArrayList<>();

    @Builder.Default
    private Boolean active = true;

    public boolean isActive() {
        return active != null && active;
    }

    @PrePersist
    protected void onCreate() {
        if (active == null) {
            active = true;
        }
    }

    public void addPurchaseBillItem(PurchaseBillItem item) {
        if (items == null) {
            items = new ArrayList<>();
        }
        items.add(item);
        item.setPurchaseBill(this);
    }
}
