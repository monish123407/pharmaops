package com.pharmacy.backend.dto;

import com.pharmacy.backend.model.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginResponse {
    private String username;
    private String fullName;
    private UserRole role;
    private String token; // Standard mock token (e.g. "mock-jwt-token-role")
}
