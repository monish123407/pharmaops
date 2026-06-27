package com.pharmacy.backend.repository;

import com.pharmacy.backend.model.DisposedBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DisposedBatchRepository extends JpaRepository<DisposedBatch, Long> {
    List<DisposedBatch> findAllByOrderByDisposalDateDesc();
}
