package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.MedicineMaster;
import com.pharmacy.backend.repository.MedicineMasterRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/medicine-masters")
public class MedicineMasterController {

    @Autowired
    private MedicineMasterRepository medicineMasterRepository;

    @GetMapping
    public List<MedicineMaster> getAllMedicineMasters(@RequestParam(value = "search", required = false) String search) {
        if (search != null && !search.trim().isEmpty()) {
            return medicineMasterRepository.findByProductNameContainingIgnoreCaseOrProductCodeContainingIgnoreCaseOrCompanyNameContainingIgnoreCaseAndActiveTrue(
                search, search, search
            );
        }
        return medicineMasterRepository.findByActiveTrue();
    }

    @GetMapping("/{id}")
    public ResponseEntity<MedicineMaster> getMedicineMasterById(@PathVariable Long id) {
        Optional<MedicineMaster> master = medicineMasterRepository.findById(id);
        return master.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public MedicineMaster createMedicineMaster(@RequestBody MedicineMaster medicineMaster) {
        return medicineMasterRepository.save(medicineMaster);
    }

    @PutMapping("/{id}")
    public ResponseEntity<MedicineMaster> updateMedicineMaster(@PathVariable Long id, @RequestBody MedicineMaster updatedMaster) {
        return medicineMasterRepository.findById(id).map(master -> {
            master.setProductName(updatedMaster.getProductName());
            master.setComposition(updatedMaster.getComposition());
            master.setProductCode(updatedMaster.getProductCode());
            master.setCompanyName(updatedMaster.getCompanyName());
            master.setCategory(updatedMaster.getCategory());
            master.setProductType(updatedMaster.getProductType());
            master.setProductQuantity(updatedMaster.getProductQuantity());
            master.setHsnCode(updatedMaster.getHsnCode());
            master.setCgst(updatedMaster.getCgst());
            master.setSgst(updatedMaster.getSgst());
            master.setRackLocation(updatedMaster.getRackLocation());
            master.setReorderLevel(updatedMaster.getReorderLevel());
            MedicineMaster saved = medicineMasterRepository.save(master);
            return ResponseEntity.ok(saved);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMedicineMaster(@PathVariable Long id) {
        return medicineMasterRepository.findById(id).map(master -> {
            master.setActive(false);
            medicineMasterRepository.save(master);
            return ResponseEntity.ok().<Void>build();
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
