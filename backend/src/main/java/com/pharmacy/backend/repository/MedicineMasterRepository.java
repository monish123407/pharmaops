package com.pharmacy.backend.repository;

import com.pharmacy.backend.model.MedicineMaster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MedicineMasterRepository extends JpaRepository<MedicineMaster, Long> {
    List<MedicineMaster> findByActiveTrue();
    
    List<MedicineMaster> findByProductNameContainingIgnoreCaseOrProductCodeContainingIgnoreCaseOrCompanyNameContainingIgnoreCaseAndActiveTrue(
        String productName, String productCode, String companyName
    );

    java.util.Optional<MedicineMaster> findFirstByProductCodeAndActiveTrue(String productCode);
    List<MedicineMaster> findByHsnCodeAndActiveTrue(String hsnCode);
}
