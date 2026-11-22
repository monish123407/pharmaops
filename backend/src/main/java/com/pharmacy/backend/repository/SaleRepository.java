package com.pharmacy.backend.repository;

import com.pharmacy.backend.model.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SaleRepository extends JpaRepository<Sale, Long> {
    List<Sale> findTop10ByOrderBySaleDateDesc();

    @Query("SELECT COALESCE(SUM(s.finalAmount), 0.0) FROM Sale s WHERE s.saleDate >= :start AND s.saleDate <= :end")
    Double sumRevenueBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(s.finalAmount), 0.0) FROM Sale s " +
           "WHERE CAST(s.saleDate AS date) >= :start AND CAST(s.saleDate AS date) <= :end")
    Double sumRevenueBetweenDates(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT s FROM Sale s WHERE s.saleDate >= :start AND s.saleDate <= :end ORDER BY s.saleDate DESC")
    List<Sale> findSalesBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT s FROM Sale s WHERE " +
           "(:search IS NULL OR LOWER(s.invoiceNumber) LIKE LOWER(CONCAT('%',:search,'%')) " +
           "  OR LOWER(s.customerName) LIKE LOWER(CONCAT('%',:search,'%')) " +
           "  OR LOWER(s.cashierName) LIKE LOWER(CONCAT('%',:search,'%')) " +
           "  OR LOWER(s.patientPhone) LIKE LOWER(CONCAT('%',:search,'%'))) " +
           "AND (:payment IS NULL OR s.paymentMethod = :payment) " +
           "AND s.saleDate >= :start AND s.saleDate <= :end " +
           "ORDER BY s.saleDate DESC")
    List<Sale> searchSales(
            @Param("search")  String search,
            @Param("payment") String payment,
            @Param("start")   LocalDateTime start,
            @Param("end")     LocalDateTime end);

    @Query("SELECT COALESCE(COUNT(s), 0) FROM Sale s WHERE s.saleDate >= :start AND s.saleDate <= :end")
    Long countBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
