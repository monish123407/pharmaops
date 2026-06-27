package com.pharmacy.backend.repository;

import com.pharmacy.backend.model.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SaleRepository extends JpaRepository<Sale, Long> {
    List<Sale> findTop10ByOrderBySaleDateDesc();
    
    @Query("SELECT COALESCE(SUM(s.finalAmount), 0.0) FROM Sale s WHERE s.saleDate >= :start AND s.saleDate <= :end")
    Double sumRevenueBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT s FROM Sale s WHERE s.saleDate >= :start AND s.saleDate <= :end")
    List<Sale> findSalesBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
