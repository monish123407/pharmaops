package com.pharmacy.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "prescriptions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Prescription {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String patientName;

    @Column(nullable = false)
    private Integer patientAge;

    @Column(nullable = false)
    private String doctorName;

    @Column(nullable = false)
    private String doctorLicense;

    @Column(nullable = false)
    @Builder.Default
    private LocalDate issueDate = LocalDate.now();

    @Column(nullable = false)
    @Builder.Default
    private String status = "PENDING"; // PENDING, DISPENSED

    private String notes;

    @OneToMany(mappedBy = "prescription", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @Builder.Default
    private List<PrescriptionItem> items = new ArrayList<>();

    public void addPrescriptionItem(PrescriptionItem item) {
        items.add(item);
        item.setPrescription(this);
    }
}
