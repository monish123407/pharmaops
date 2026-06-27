package com.pharmacy.backend.repository;

import com.pharmacy.backend.model.PurchaseBill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PurchaseBillRepository extends JpaRepository<PurchaseBill, Long> {
    List<PurchaseBill> findByActiveTrueOrderByPurchaseDateDesc();

    @org.springframework.data.jpa.repository.Query("SELECT MAX(pb.tokenNumber) FROM PurchaseBill pb WHERE pb.purchaseDate >= :startDate AND pb.active = true")
    Integer findMaxTokenNumberSince(@org.springframework.data.repository.query.Param("startDate") java.time.LocalDateTime startDate);

    @org.springframework.data.jpa.repository.Query("SELECT pb FROM PurchaseBill pb WHERE pb.purchaseDate >= :start AND pb.purchaseDate <= :end AND pb.active = true")
    List<PurchaseBill> findPurchaseBillsBetween(@org.springframework.data.repository.query.Param("start") java.time.LocalDateTime start, @org.springframework.data.repository.query.Param("end") java.time.LocalDateTime end);

    @org.springframework.data.jpa.repository.Query("SELECT pbi FROM PurchaseBillItem pbi JOIN FETCH pbi.purchaseBill pb WHERE pbi.productCode = :sku AND pbi.batchNumber = :batchNumber AND pb.supplierName = :supplierName AND pb.active = true ORDER BY pb.invoiceDate DESC")
    List<com.pharmacy.backend.model.PurchaseBillItem> findPurchaseBillItemsForStockout(
        @org.springframework.data.repository.query.Param("sku") String sku, 
        @org.springframework.data.repository.query.Param("batchNumber") String batchNumber, 
        @org.springframework.data.repository.query.Param("supplierName") String supplierName
    );
}
