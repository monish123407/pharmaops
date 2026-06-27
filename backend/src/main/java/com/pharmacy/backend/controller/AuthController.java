package com.pharmacy.backend.controller;

import com.pharmacy.backend.dto.LoginRequest;
import com.pharmacy.backend.dto.LoginResponse;
import com.pharmacy.backend.model.User;
import com.pharmacy.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        Optional<User> userOpt = userRepository.findByUsername(request.getUsername());
        
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (user.getPassword().equals(request.getPassword()) && user.isActive()) {
                LoginResponse response = LoginResponse.builder()
                        .username(user.getUsername())
                        .fullName(user.getFullName())
                        .role(user.getRole())
                        .token("mock-jwt-token-" + user.getRole().name().toLowerCase() + "-" + user.getUsername())
                        .build();
                return ResponseEntity.ok(response);
            }
        }
        
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body("Invalid username or password");
    }
}
