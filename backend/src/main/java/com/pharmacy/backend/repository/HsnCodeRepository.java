package com.pharmacy.backend.repository;

import com.pharmacy.backend.model.HsnCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface HsnCodeRepository extends JpaRepository<HsnCode, Long> {
    Optional<HsnCode> findByCode(String code);
}
