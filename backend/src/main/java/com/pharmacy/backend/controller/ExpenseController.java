package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.Expense;
import com.pharmacy.backend.repository.ExpenseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    @Autowired
    private ExpenseRepository expenseRepository;

    // ── GET all (with optional filters) ─────────────────────────────────────
    @GetMapping
    public List<Expense> getExpenses(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        if (startDate != null && endDate != null) {
            return expenseRepository.findByFilters(category, startDate, endDate);
        }
        if (category != null && !category.isBlank()) {
            return expenseRepository.findByCategoryAndActiveTrueOrderByExpenseDateDesc(category);
        }
        return expenseRepository.findByActiveTrueOrderByExpenseDateDesc();
    }

    // ── GET single ───────────────────────────────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<Expense> getById(@PathVariable Long id) {
        return expenseRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── POST create ──────────────────────────────────────────────────────────
    @PostMapping
    public Expense create(@RequestBody Expense expense) {
        return expenseRepository.save(expense);
    }

    // ── PUT update ───────────────────────────────────────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<Expense> update(@PathVariable Long id, @RequestBody Expense updated) {
        return expenseRepository.findById(id).map(e -> {
            e.setExpenseDate(updated.getExpenseDate());
            e.setCategory(updated.getCategory());
            e.setDescription(updated.getDescription());
            e.setAmount(updated.getAmount());
            e.setPaymentMethod(updated.getPaymentMethod());
            e.setReferenceNumber(updated.getReferenceNumber());
            e.setPaidTo(updated.getPaidTo());
            e.setNotes(updated.getNotes());
            e.setReceiptNumber(updated.getReceiptNumber());
            return ResponseEntity.ok(expenseRepository.save(e));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── DELETE (soft) ────────────────────────────────────────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return expenseRepository.findById(id).map(e -> {
            e.setActive(false);
            expenseRepository.save(e);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── GET summary stats ────────────────────────────────────────────────────
    @GetMapping("/summary")
    public Map<String, Object> getSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        LocalDate now = LocalDate.now();
        LocalDate start = startDate != null ? startDate : now.withDayOfMonth(1);
        LocalDate end   = endDate   != null ? endDate   : now;

        // Total for given range
        Double totalRange = expenseRepository.sumByDateRange(start, end);

        // Current month total
        Double monthTotal = expenseRepository.sumByDateRange(
                now.withDayOfMonth(1), now);

        // Current year total
        Double yearTotal = expenseRepository.sumByDateRange(
                now.withDayOfYear(1), now);

        // Category breakdown
        List<Object[]> rows = expenseRepository.sumByCategory(start, end);
        List<Map<String, Object>> categoryBreakdown = new ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("category", row[0]);
            item.put("total", row[1]);
            categoryBreakdown.add(item);
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalForRange", totalRange != null ? totalRange : 0.0);
        summary.put("monthTotal", monthTotal  != null ? monthTotal  : 0.0);
        summary.put("yearTotal",  yearTotal   != null ? yearTotal   : 0.0);
        summary.put("startDate",  start.toString());
        summary.put("endDate",    end.toString());
        summary.put("categoryBreakdown", categoryBreakdown);
        return summary;
    }
}
