package com.pharmacy.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "suppliers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Supplier {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String contactName;
    private String phone;
    private String email;
    private String address;
    private String suppliedCompanies; // Comma-separated brands/companies supplied by this wholesaler

    private String gstn;      // GSTIN number
    private String dlNo;      // Drug License Number
    private String pan;       // PAN number

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
}
