package com.pharmacy.backend.repository;

import com.pharmacy.backend.model.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    List<Customer> findByActiveTrue();
    
    Optional<Customer> findByPhoneAndActiveTrue(String phone);
    
    @Query("SELECT c FROM Customer c WHERE c.active = true AND (LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) OR c.phone LIKE CONCAT('%', :query, '%'))")
    List<Customer> searchCustomers(@Param("query") String query);
}
