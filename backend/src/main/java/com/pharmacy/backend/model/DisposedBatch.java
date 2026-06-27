package com.pharmacy.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Entity
@Table(name = "disposed_batches")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DisposedBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String sku;

    @Column(nullable = false)
    private String productName;

    private String batchNumber;

    @Column(nullable = false)
    private LocalDate expiryDate;

    @Column(nullable = false)
    private Integer quantityDisposed;

    @Column(nullable = false)
    private Double costPrice;

    @Column(nullable = false)
    private LocalDate disposalDate;

    @Column(nullable = false)
    private String reason; // e.g. "Expired", "Damaged", "Recalled"

    private String disposedBy;
}
