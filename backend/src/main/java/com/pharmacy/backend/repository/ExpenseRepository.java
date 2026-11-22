package com.pharmacy.backend.repository;

import com.pharmacy.backend.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findByActiveTrueOrderByExpenseDateDesc();

    List<Expense> findByCategoryAndActiveTrueOrderByExpenseDateDesc(String category);

    @Query("SELECT e FROM Expense e WHERE e.active = true " +
           "AND e.expenseDate BETWEEN :startDate AND :endDate " +
           "ORDER BY e.expenseDate DESC")
    List<Expense> findByDateRange(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT e FROM Expense e WHERE e.active = true " +
           "AND (:category IS NULL OR e.category = :category) " +
           "AND e.expenseDate BETWEEN :startDate AND :endDate " +
           "ORDER BY e.expenseDate DESC")
    List<Expense> findByFilters(
            @Param("category") String category,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE e.active = true " +
           "AND e.expenseDate BETWEEN :startDate AND :endDate")
    Double sumByDateRange(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT e.category, COALESCE(SUM(e.amount), 0) FROM Expense e " +
           "WHERE e.active = true AND e.expenseDate BETWEEN :startDate AND :endDate " +
           "GROUP BY e.category ORDER BY SUM(e.amount) DESC")
    List<Object[]> sumByCategory(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
