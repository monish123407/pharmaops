package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.HsnCode;
import com.pharmacy.backend.model.MedicineMaster;
import com.pharmacy.backend.model.Medicine;
import com.pharmacy.backend.repository.HsnCodeRepository;
import com.pharmacy.backend.repository.MedicineMasterRepository;
import com.pharmacy.backend.repository.MedicineRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/hsn-codes")
public class HsnCodeController {

    @Autowired
    private HsnCodeRepository hsnCodeRepository;

    @Autowired
    private MedicineMasterRepository medicineMasterRepository;

    @Autowired
    private MedicineRepository medicineRepository;

    @GetMapping
    public List<HsnCode> getAllHsnCodes() {
        return hsnCodeRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<HsnCode> getHsnCodeById(@PathVariable Long id) {
        return hsnCodeRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createHsnCode(@RequestBody HsnCode hsnCode) {
        String code = hsnCode.getCode() != null ? hsnCode.getCode().trim() : "";
        if (code.isEmpty()) {
            return ResponseEntity.badRequest().body("HSN Code cannot be empty.");
        }
        Optional<HsnCode> existing = hsnCodeRepository.findByCode(code);
        if (existing.isPresent()) {
            return ResponseEntity.badRequest().body("HSN Code already exists.");
        }
        hsnCode.setCode(code);
        HsnCode saved = hsnCodeRepository.save(hsnCode);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateHsnCode(@PathVariable Long id, @RequestBody HsnCode updatedHsn) {
        return hsnCodeRepository.findById(id).map(hsn -> {
            String oldCode = hsn.getCode();
            String newCode = updatedHsn.getCode() != null ? updatedHsn.getCode().trim() : "";

            if (newCode.isEmpty()) {
                return ResponseEntity.badRequest().body("HSN Code cannot be empty.");
            }

            // Check if HSN code was changed, and if the new code exists on another record
            if (!oldCode.equalsIgnoreCase(newCode)) {
                Optional<HsnCode> existing = hsnCodeRepository.findByCode(newCode);
                if (existing.isPresent() && !existing.get().getId().equals(id)) {
                    return ResponseEntity.badRequest().body("HSN Code already exists on another configuration.");
                }
            }

            hsn.setCode(newCode);
            hsn.setCgst(updatedHsn.getCgst());
            hsn.setSgst(updatedHsn.getSgst());
            hsn.setDescription(updatedHsn.getDescription());

            HsnCode savedHsn = hsnCodeRepository.save(hsn);

            // Cascade HSN & GST Rate updates to all MedicineMaster records matching the old HSN code
            List<MedicineMaster> masters = medicineMasterRepository.findByHsnCodeAndActiveTrue(oldCode);
            for (MedicineMaster mm : masters) {
                mm.setHsnCode(newCode);
                mm.setCgst(savedHsn.getCgst());
                mm.setSgst(savedHsn.getSgst());
                medicineMasterRepository.save(mm);
            }

            // Cascade updates to all active stock Medicine batches matching the old HSN code
            double totalGstRate = savedHsn.getCgst() + savedHsn.getSgst();
            List<Medicine> activeBatches = medicineRepository.findByActiveTrue();
            for (Medicine med : activeBatches) {
                if (med.getHsnCode() != null && med.getHsnCode().equalsIgnoreCase(oldCode)) {
                    med.setHsnCode(newCode);
                    med.setGstRate(totalGstRate);
                    medicineRepository.save(med);
                }
            }

            return ResponseEntity.ok(savedHsn);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteHsnCode(@PathVariable Long id) {
        return hsnCodeRepository.findById(id).map(hsn -> {
            hsnCodeRepository.delete(hsn);
            return ResponseEntity.ok().<Void>build();
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
