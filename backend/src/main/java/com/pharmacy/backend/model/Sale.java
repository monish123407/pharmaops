package com.pharmacy.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "sales")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Sale {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String invoiceNumber;

    @Column(nullable = false)
    @Builder.Default
    private LocalDateTime saleDate = LocalDateTime.now();

    private String customerName;

    private String patientPhone;
    private String doctorName;
    private String patientAddress;

    @Column(nullable = false)
    private Double totalAmount;

    @Column(nullable = false)
    private Double discountAmount;

    @Column(nullable = false)
    private Double taxAmount;

    @Column(nullable = false)
    private Double finalAmount;

    @Column(nullable = false)
    private String paymentMethod; // Cash, Card, UPI, etc.

    @Column(nullable = false)
    private String cashierName;

    private Long prescriptionId;

    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @Builder.Default
    private List<SaleItem> items = new ArrayList<>();

    public void addSaleItem(SaleItem item) {
        items.add(item);
        item.setSale(this);
    }
}
