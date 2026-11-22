package com.pharmacy.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "hsn_codes")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HsnCode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String code; // e.g. "3004"

    @Column(nullable = false)
    private Double cgst; // Central GST Rate

    @Column(nullable = false)
    private Double sgst; // State GST Rate

    @Column(nullable = true)
    private String description; // Description of the goods category
}
