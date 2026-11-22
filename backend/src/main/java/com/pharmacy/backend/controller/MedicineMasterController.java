package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.MedicineMaster;
import com.pharmacy.backend.repository.MedicineMasterRepository;
import com.pharmacy.backend.repository.MedicineRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Optional;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/medicine-masters")
public class MedicineMasterController {

    @Autowired
    private MedicineMasterRepository medicineMasterRepository;

    @Autowired
    private MedicineRepository medicineRepository;

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

    // ── Dedicated HSN Code Update (with cascade to active stock batches) ──
    @PatchMapping("/{id}/hsn")
    public ResponseEntity<MedicineMaster> updateHsn(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, Object> payload) {

        return medicineMasterRepository.findById(id).map(master -> {
            String newHsn  = (String) payload.get("hsnCode");
            Object cgstObj = payload.get("cgst");
            Object sgstObj = payload.get("sgst");

            if (newHsn != null && !newHsn.isBlank()) {
                master.setHsnCode(newHsn.trim());
            }
            if (cgstObj != null) {
                master.setCgst(((Number) cgstObj).doubleValue());
            }
            if (sgstObj != null) {
                master.setSgst(((Number) sgstObj).doubleValue());
            }

            MedicineMaster saved = medicineMasterRepository.save(master);

            // Cascade HSN + GST rate to all active Medicine batches with the same SKU
            if (newHsn != null && !newHsn.isBlank()) {
                double totalGst = (saved.getCgst() != null ? saved.getCgst() : 0)
                                + (saved.getSgst() != null ? saved.getSgst() : 0);
                medicineRepository.findBySkuAndActiveTrue(saved.getProductCode()).forEach(med -> {
                    med.setHsnCode(saved.getHsnCode());
                    med.setGstRate(totalGst);
                    medicineRepository.save(med);
                });
            }

            return ResponseEntity.ok(saved);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    // ── CSV Export Endpoint ──
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportToCsv() {
        List<MedicineMaster> masters = medicineMasterRepository.findByActiveTrue();
        StringBuilder sb = new StringBuilder();
        
        sb.append("Product Name,Product Code,Composition,Company,Category,Product Type,Pack Size,HSN Code,CGST,SGST,Rack Location,Reorder Level\n");
        
        for (MedicineMaster mm : masters) {
            sb.append(escapeCsv(mm.getProductName())).append(",")
              .append(escapeCsv(mm.getProductCode())).append(",")
              .append(escapeCsv(mm.getComposition())).append(",")
              .append(escapeCsv(mm.getCompanyName())).append(",")
              .append(escapeCsv(mm.getCategory())).append(",")
              .append(escapeCsv(mm.getProductType())).append(",")
              .append(escapeCsv(mm.getProductQuantity())).append(",")
              .append(escapeCsv(mm.getHsnCode())).append(",")
              .append(mm.getCgst() != null ? mm.getCgst() : 0.0).append(",")
              .append(mm.getSgst() != null ? mm.getSgst() : 0.0).append(",")
              .append(escapeCsv(mm.getRackLocation())).append(",")
              .append(mm.getReorderLevel() != null ? mm.getReorderLevel() : "").append("\n");
        }
        
        byte[] csvBytes = sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "medicine_masters.csv");
        
        return ResponseEntity.ok().headers(headers).body(csvBytes);
    }

    // ── CSV Import Endpoint ──
    @PostMapping("/import")
    public ResponseEntity<?> importFromCsv(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("Please upload a valid CSV file.");
        }
        
        try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(file.getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
            String line;
            int inserted = 0;
            int updated = 0;
            int rowNum = 0;
            
            while ((line = reader.readLine()) != null) {
                rowNum++;
                if (rowNum == 1) continue; // Skip header
                if (line.trim().isEmpty()) continue;
                
                List<String> fields = parseCsvLine(line);
                if (fields.size() < 2) continue;
                
                String productName = fields.get(0);
                String productCode = fields.get(1);
                
                if (productCode == null || productCode.trim().isEmpty()) continue;
                
                String composition = fields.size() > 2 ? fields.get(2) : "";
                String companyName = fields.size() > 3 ? fields.get(3) : "";
                String category = fields.size() > 4 ? fields.get(4) : "medicine";
                String productType = fields.size() > 5 ? fields.get(5) : "Tablet";
                String productQuantity = fields.size() > 6 ? fields.get(6) : "10 Tablets/Strip";
                String hsnCode = fields.size() > 7 ? fields.get(7) : "3004";
                
                double cgst = 6.0;
                if (fields.size() > 8 && !fields.get(8).isEmpty()) {
                    try { cgst = Double.parseDouble(fields.get(8)); } catch (Exception e) {}
                }
                
                double sgst = 6.0;
                if (fields.size() > 9 && !fields.get(9).isEmpty()) {
                    try { sgst = Double.parseDouble(fields.get(9)); } catch (Exception e) {}
                }
                
                String rackLocation = fields.size() > 10 ? fields.get(10) : "";
                Integer reorderLevel = null;
                if (fields.size() > 11 && !fields.get(11).isEmpty()) {
                    try { reorderLevel = Integer.parseInt(fields.get(11)); } catch (Exception e) {}
                }
                
                Optional<MedicineMaster> existingOpt = medicineMasterRepository.findFirstByProductCodeAndActiveTrue(productCode);
                MedicineMaster mm;
                if (existingOpt.isPresent()) {
                    mm = existingOpt.get();
                    updated++;
                } else {
                    mm = new MedicineMaster();
                    mm.setProductCode(productCode);
                    mm.setActive(true);
                    inserted++;
                }
                
                mm.setProductName(productName);
                mm.setComposition(composition);
                mm.setCompanyName(companyName);
                mm.setCategory(category.toLowerCase());
                mm.setProductType(productType);
                mm.setProductQuantity(productQuantity);
                mm.setHsnCode(hsnCode);
                mm.setCgst(cgst);
                mm.setSgst(sgst);
                mm.setRackLocation(rackLocation.isEmpty() ? null : rackLocation);
                mm.setReorderLevel(reorderLevel);
                
                medicineMasterRepository.save(mm);
                
                // Cascade changes to active batches
                double totalGst = cgst + sgst;
                medicineRepository.findBySkuAndActiveTrue(productCode).forEach(med -> {
                    med.setHsnCode(hsnCode);
                    med.setGstRate(totalGst);
                    medicineRepository.save(med);
                });
            }
            
            Map<String, Object> result = new HashMap<>();
            result.put("inserted", inserted);
            result.put("updated", updated);
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Failed to parse CSV file: " + e.getMessage());
        }
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private List<String> parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                values.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        values.add(sb.toString().trim());
        return values;
    }
}
