package com.pharmacy.backend.controller;

import com.pharmacy.backend.dto.DashboardStats;
import com.pharmacy.backend.repository.MedicineRepository;
import com.pharmacy.backend.repository.SaleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @Autowired
    private MedicineRepository medicineRepository;

    @Autowired
    private SaleRepository saleRepository;

    @GetMapping("/stats")
    public DashboardStats getStats() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(23, 59, 59);

        // 1. Core KPIs
        Double revenueToday = saleRepository.sumRevenueBetween(startOfDay, endOfDay);
        if (revenueToday == null) {
            revenueToday = 0.0;
        }

        List<com.pharmacy.backend.model.Medicine> activeMeds = medicineRepository.findByActiveTrue();
        
        java.util.Map<String, List<com.pharmacy.backend.model.Medicine>> groupedBySku = activeMeds.stream()
                .collect(java.util.stream.Collectors.groupingBy(com.pharmacy.backend.model.Medicine::getSku));

        long lowStock = groupedBySku.values().stream()
                .filter(batches -> {
                    int totalStock = batches.stream().mapToInt(com.pharmacy.backend.model.Medicine::getStockLevel).sum();
                    int maxReorder = Math.max(batches.stream().mapToInt(com.pharmacy.backend.model.Medicine::getReorderLevel).max().orElse(0), 10);
                    return totalStock <= maxReorder;
                })
                .count();

        long expired = medicineRepository.findExpiredMedicines(today).size();
        long expiringSoon = medicineRepository.findExpiringSoonMedicines(today, today.plusDays(30)).size();
        long totalMeds = groupedBySku.size();

        // 2. Recent Sales
        List<com.pharmacy.backend.model.Sale> recentSales = saleRepository.findTop10ByOrderBySaleDateDesc();

        // 3. Dynamic Last 7 Days Revenue Chart Points
        List<DashboardStats.ChartPoint> chartData = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            LocalDateTime start = date.atStartOfDay();
            LocalDateTime end = date.atTime(23, 59, 59);
            Double dailyRevenue = saleRepository.sumRevenueBetween(start, end);
            String dayName = date.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
            chartData.add(new DashboardStats.ChartPoint(dayName, dailyRevenue != null ? dailyRevenue : 0.0));
        }

        return DashboardStats.builder()
                .totalRevenueToday(revenueToday)
                .lowStockCount(lowStock)
                .expiredCount(expired)
                .expiringSoonCount(expiringSoon)
                .totalMedicines(totalMeds)
                .recentSales(recentSales)
                .revenueChartData(chartData)
                .build();
    }
}
