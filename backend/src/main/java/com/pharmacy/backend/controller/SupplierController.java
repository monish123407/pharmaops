package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.Supplier;
import com.pharmacy.backend.repository.SupplierRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

    @Autowired
    private SupplierRepository supplierRepository;

    @GetMapping
    public List<Supplier> getAllSuppliers() {
        return supplierRepository.findByActiveTrue();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Supplier> getSupplierById(@PathVariable Long id) {
        return supplierRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public Supplier createSupplier(@RequestBody Supplier supplier) {
        return supplierRepository.save(supplier);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Supplier> updateSupplier(@PathVariable Long id, @RequestBody Supplier updatedSupplier) {
        return supplierRepository.findById(id).map(supplier -> {
            supplier.setName(updatedSupplier.getName());
            supplier.setContactName(updatedSupplier.getContactName());
            supplier.setPhone(updatedSupplier.getPhone());
            supplier.setEmail(updatedSupplier.getEmail());
            supplier.setAddress(updatedSupplier.getAddress());
            supplier.setSuppliedCompanies(updatedSupplier.getSuppliedCompanies());
            supplier.setGstn(updatedSupplier.getGstn());
            supplier.setDlNo(updatedSupplier.getDlNo());
            supplier.setPan(updatedSupplier.getPan());
            Supplier saved = supplierRepository.save(supplier);
            return ResponseEntity.ok(saved);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSupplier(@PathVariable Long id) {
        return supplierRepository.findById(id).map(supplier -> {
            supplier.setActive(false);
            supplierRepository.save(supplier);
            return ResponseEntity.ok().<Void>build();
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
