package com.pharmacy.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "expenses")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate expenseDate;

    @Column(nullable = false)
    private String category;       // Rent, Electricity, Staff Salary, etc.

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private Double amount;

    @Column(nullable = false)
    private String paymentMethod;  // Cash, UPI, Bank Transfer, Cheque

    private String referenceNumber; // Cheque no / UPI Ref / Transaction ID
    private String paidTo;          // Vendor / Person paid to
    private String notes;
    private String receiptNumber;

    @Builder.Default
    private Boolean active = true;

    @PrePersist
    protected void onCreate() {
        if (active == null) active = true;
        if (expenseDate == null) expenseDate = LocalDate.now();
    }
}
