package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.Customer;
import com.pharmacy.backend.repository.CustomerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    @Autowired
    private CustomerRepository customerRepository;

    @GetMapping
    public List<Customer> getAllCustomers(@RequestParam(required = false) String search) {
        if (search != null && !search.trim().isEmpty()) {
            return customerRepository.searchCustomers(search.trim());
        }
        return customerRepository.findByActiveTrue();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Customer> getCustomerById(@PathVariable Long id) {
        return customerRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/by-phone/{phone}")
    public ResponseEntity<Customer> getCustomerByPhone(@PathVariable String phone) {
        return customerRepository.findByPhoneAndActiveTrue(phone.trim())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createCustomer(@RequestBody Customer customer) {
        if (customer.getPhone() == null || customer.getPhone().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Phone number is required.");
        }
        Optional<Customer> existing = customerRepository.findByPhoneAndActiveTrue(customer.getPhone().trim());
        if (existing.isPresent()) {
            return ResponseEntity.badRequest().body("Customer with phone number " + customer.getPhone() + " already exists.");
        }
        customer.setPhone(customer.getPhone().trim());
        return ResponseEntity.ok(customerRepository.save(customer));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateCustomer(@PathVariable Long id, @RequestBody Customer updatedCustomer) {
        if (updatedCustomer.getPhone() == null || updatedCustomer.getPhone().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Phone number is required.");
        }
        return customerRepository.findById(id).map(customer -> {
            Optional<Customer> existing = customerRepository.findByPhoneAndActiveTrue(updatedCustomer.getPhone().trim());
            if (existing.isPresent() && !existing.get().getId().equals(id)) {
                return ResponseEntity.badRequest().body("Customer with phone number " + updatedCustomer.getPhone() + " already exists.");
            }
            customer.setName(updatedCustomer.getName());
            customer.setPhone(updatedCustomer.getPhone().trim());
            customer.setEmail(updatedCustomer.getEmail());
            customer.setAddress(updatedCustomer.getAddress());
            return ResponseEntity.ok(customerRepository.save(customer));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCustomer(@PathVariable Long id) {
        return customerRepository.findById(id).map(customer -> {
            customer.setActive(false);
            customerRepository.save(customer);
            return ResponseEntity.ok().<Void>build();
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
