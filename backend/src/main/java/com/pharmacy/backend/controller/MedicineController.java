package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.Medicine;
import com.pharmacy.backend.repository.MedicineRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/medicines")
public class MedicineController {

    @Autowired
    private MedicineRepository medicineRepository;

    @GetMapping
    public List<Medicine> getAllMedicines(@RequestParam(value = "search", required = false) String search) {
        if (search != null && !search.trim().isEmpty()) {
            return medicineRepository.findByNameContainingIgnoreCaseOrGenericNameContainingIgnoreCaseOrSkuContainingIgnoreCaseAndActiveTrue(
                search, search, search
            );
        }
        return medicineRepository.findByActiveTrue();
    }

    @GetMapping("/low-stock")
    public List<Medicine> getLowStockMedicines() {
        return medicineRepository.findLowStockMedicines();
    }

    @GetMapping("/expired")
    public List<Medicine> getExpiredMedicines() {
        return medicineRepository.findExpiredMedicines(LocalDate.now());
    }

    @GetMapping("/expiring-soon")
    public List<Medicine> getExpiringSoonMedicines() {
        // Expiring in 30 days
        return medicineRepository.findExpiringSoonMedicines(LocalDate.now(), LocalDate.now().plusDays(30));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Medicine> getMedicineById(@PathVariable Long id) {
        Optional<Medicine> medicine = medicineRepository.findById(id);
        return medicine.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public Medicine createMedicine(@RequestBody Medicine medicine) {
        if (medicine.getExpiryDate() == null) {
            medicine.setExpiryDate(LocalDate.now().plusYears(1));
        }
        

        
        return medicineRepository.save(medicine);
    }

    @PostMapping("/batch")
    public List<Medicine> createMedicinesBatch(@RequestBody List<Medicine> medicines) {
        medicines.forEach(medicine -> {
            if (medicine.getExpiryDate() == null) {
                medicine.setExpiryDate(LocalDate.now().plusYears(1));
            }
        });
        return medicineRepository.saveAll(medicines);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Medicine> updateMedicine(@PathVariable Long id, @RequestBody Medicine updatedMedicine) {
        return medicineRepository.findById(id).map(medicine -> {

            medicine.setName(updatedMedicine.getName());
            medicine.setGenericName(updatedMedicine.getGenericName());
            medicine.setSku(updatedMedicine.getSku());
            medicine.setBatchNumber(updatedMedicine.getBatchNumber());
            medicine.setExpiryDate(updatedMedicine.getExpiryDate());
            medicine.setStockLevel(updatedMedicine.getStockLevel());
            medicine.setReorderLevel(updatedMedicine.getReorderLevel());
            medicine.setCostPrice(updatedMedicine.getCostPrice());
            medicine.setSellingPrice(updatedMedicine.getSellingPrice());
            medicine.setManufacturer(updatedMedicine.getManufacturer());
            medicine.setRackLocation(updatedMedicine.getRackLocation());
            Medicine saved = medicineRepository.save(medicine);
            return ResponseEntity.ok(saved);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMedicine(@PathVariable Long id) {
        return medicineRepository.findById(id).map(medicine -> {
            medicine.setActive(false);
            medicineRepository.save(medicine);
            return ResponseEntity.ok().<Void>build();
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
