package com.pharmacy.backend.repository;

import com.pharmacy.backend.model.Prescription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PrescriptionRepository extends JpaRepository<Prescription, Long> {
    List<Prescription> findByStatus(String status);
    List<Prescription> findByPatientNameContainingIgnoreCase(String patientName);
}
