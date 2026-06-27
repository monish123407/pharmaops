package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.Prescription;
import com.pharmacy.backend.repository.PrescriptionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/prescriptions")
public class PrescriptionController {

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @GetMapping
    public List<Prescription> getAllPrescriptions(@RequestParam(value = "search", required = false) String search) {
        if (search != null && !search.trim().isEmpty()) {
            return prescriptionRepository.findByPatientNameContainingIgnoreCase(search);
        }
        return prescriptionRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Prescription> getPrescriptionById(@PathVariable Long id) {
        return prescriptionRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public Prescription createPrescription(@RequestBody Prescription prescription) {
        // Establish bidirectional linkage
        if (prescription.getItems() != null) {
            prescription.getItems().forEach(item -> item.setPrescription(prescription));
        }
        return prescriptionRepository.save(prescription);
    }

    @PutMapping("/{id}/dispense")
    public ResponseEntity<Prescription> dispensePrescription(@PathVariable Long id) {
        return prescriptionRepository.findById(id).map(prescription -> {
            prescription.setStatus("DISPENSED");
            Prescription saved = prescriptionRepository.save(prescription);
            return ResponseEntity.ok(saved);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
