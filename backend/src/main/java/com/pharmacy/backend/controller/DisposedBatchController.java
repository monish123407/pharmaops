package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.DisposedBatch;
import com.pharmacy.backend.model.Medicine;
import com.pharmacy.backend.repository.DisposedBatchRepository;
import com.pharmacy.backend.repository.MedicineRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/disposed-batches")
public class DisposedBatchController {

    @Autowired
    private DisposedBatchRepository disposedBatchRepository;

    @Autowired
    private MedicineRepository medicineRepository;

    @GetMapping
    public List<DisposedBatch> getAllDisposedBatches() {
        return disposedBatchRepository.findAllByOrderByDisposalDateDesc();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> disposeBatch(@RequestBody DisposalRequest request) {
        if (request.getMedicineId() == null) {
            return ResponseEntity.badRequest().body("Medicine ID is required");
        }
        if (request.getQuantityDisposed() == null || request.getQuantityDisposed() <= 0) {
            return ResponseEntity.badRequest().body("Quantity disposed must be greater than zero");
        }

        Optional<Medicine> medicineOpt = medicineRepository.findById(request.getMedicineId());
        if (medicineOpt.isEmpty() || !medicineOpt.get().isActive()) {
            return ResponseEntity.badRequest().body("Medicine batch not found or inactive");
        }

        Medicine medicine = medicineOpt.get();
        if (request.getQuantityDisposed() > medicine.getStockLevel()) {
            return ResponseEntity.badRequest().body("Quantity to dispose exceeds current stock level");
        }

        // 1. Deduct stock level
        int originalStock = medicine.getStockLevel();
        medicine.setStockLevel(originalStock - request.getQuantityDisposed());
        if (medicine.getStockLevel() == 0) {
            medicine.setActive(false); // Purge from active search lists if fully disposed
        }
        medicineRepository.save(medicine);

        // 2. Create disposal entry
        DisposedBatch disposedBatch = DisposedBatch.builder()
                .sku(medicine.getSku())
                .productName(medicine.getName())
                .batchNumber(medicine.getBatchNumber())
                .expiryDate(medicine.getExpiryDate())
                .quantityDisposed(request.getQuantityDisposed())
                .costPrice(medicine.getCostPrice())
                .disposalDate(LocalDate.now())
                .reason(request.getReason() != null && !request.getReason().trim().isEmpty() ? request.getReason() : "Expired")
                .disposedBy(request.getDisposedBy() != null && !request.getDisposedBy().trim().isEmpty() ? request.getDisposedBy() : "System Admin")
                .build();

        DisposedBatch saved = disposedBatchRepository.save(disposedBatch);
        return ResponseEntity.ok(saved);
    }

    public static class DisposalRequest {
        private Long medicineId;
        private Integer quantityDisposed;
        private String reason;
        private String disposedBy;

        public Long getMedicineId() { return medicineId; }
        public void setMedicineId(Long medicineId) { this.medicineId = medicineId; }

        public Integer getQuantityDisposed() { return quantityDisposed; }
        public void setQuantityDisposed(Integer quantityDisposed) { this.quantityDisposed = quantityDisposed; }

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }

        public String getDisposedBy() { return disposedBy; }
        public void setDisposedBy(String disposedBy) { this.disposedBy = disposedBy; }
    }
}
