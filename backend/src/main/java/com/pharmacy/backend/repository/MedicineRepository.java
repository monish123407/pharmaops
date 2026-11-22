package com.pharmacy.backend.repository;

import com.pharmacy.backend.model.Medicine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface MedicineRepository extends JpaRepository<Medicine, Long> {
    List<Medicine> findByActiveTrue();
    
    @Query("SELECT m FROM Medicine m WHERE m.stockLevel <= m.reorderLevel AND m.active = true")
    List<Medicine> findLowStockMedicines();
    
    @Query("SELECT m FROM Medicine m WHERE m.expiryDate <= :today AND m.active = true")
    List<Medicine> findExpiredMedicines(@Param("today") LocalDate today);
    
    @Query("SELECT m FROM Medicine m WHERE m.expiryDate > :today AND m.expiryDate <= :limitDate AND m.active = true")
    List<Medicine> findExpiringSoonMedicines(@Param("today") LocalDate today, @Param("limitDate") LocalDate limitDate);

    List<Medicine> findByNameContainingIgnoreCaseOrGenericNameContainingIgnoreCaseOrSkuContainingIgnoreCaseAndActiveTrue(
        String name, String genericName, String sku
    );

    java.util.Optional<Medicine> findFirstBySkuAndActiveTrue(String sku);
    java.util.Optional<Medicine> findFirstBySkuAndBatchNumberAndActiveTrue(String sku, String batchNumber);
    List<Medicine> findBySkuAndActiveTrue(String sku);
}
