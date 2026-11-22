package com.pharmacy.backend.controller;

import com.pharmacy.backend.dto.DashboardStats;
import com.pharmacy.backend.model.Medicine;
import com.pharmacy.backend.model.MedicineMaster;
import com.pharmacy.backend.model.Sale;
import com.pharmacy.backend.model.SaleItem;
import com.pharmacy.backend.repository.ExpenseRepository;
import com.pharmacy.backend.repository.MedicineMasterRepository;
import com.pharmacy.backend.repository.MedicineRepository;
import com.pharmacy.backend.repository.SaleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.TextStyle;
import java.util.*;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @Autowired private MedicineRepository       medicineRepository;
    @Autowired private SaleRepository           saleRepository;
    @Autowired private ExpenseRepository        expenseRepository;
    @Autowired private MedicineMasterRepository medicineMasterRepository;

    @GetMapping("/stats")
    public DashboardStats getStats() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay   = today.atTime(23, 59, 59);

        // ── 1. Fetch Sales for periods ───────────────────────────────────
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate yearStart  = today.withDayOfYear(1);

        List<Sale> salesToday = saleRepository.findSalesBetween(startOfDay, endOfDay);
        List<Sale> salesMonth = saleRepository.findSalesBetween(monthStart.atStartOfDay(), endOfDay);
        List<Sale> salesYear  = saleRepository.findSalesBetween(yearStart.atStartOfDay(),  endOfDay);

        // ── 2. Compute actual Gross Profit (Revenue - Cost of Goods Sold) ─
        double grossProfitToday = calculateGrossProfit(salesToday);
        double monthlyGross     = calculateGrossProfit(salesMonth);
        double yearlyGross      = calculateGrossProfit(salesYear);

        // ── 3. Fetch Expenses ─────────────────────────────────────────────
        Double expensesToday = nvl(expenseRepository.sumByDateRange(today, today));
        Double expensesMonth = nvl(expenseRepository.sumByDateRange(monthStart, today));
        Double expensesYear  = nvl(expenseRepository.sumByDateRange(yearStart,  today));

        // ── 4. Calculate Net Profits ──────────────────────────────────────
        double netProfitToday   = grossProfitToday - expensesToday;
        double monthlyNetProfit = monthlyGross     - expensesMonth;
        double yearlyNetProfit  = yearlyGross      - expensesYear;

        // Daily gross sales revenue for KPI display
        Double revenueToday = salesToday.stream().mapToDouble(Sale::getFinalAmount).sum();

        // ── 5. Inventory KPIs ─────────────────────────────────────────────
        List<Medicine> activeMeds = medicineRepository.findByActiveTrue();

        java.util.Map<String, List<Medicine>> groupedBySku =
                activeMeds.stream()
                        .collect(java.util.stream.Collectors.groupingBy(
                                Medicine::getSku));

        long lowStock = groupedBySku.values().stream()
                .filter(batches -> {
                    int total   = batches.stream().mapToInt(Medicine::getStockLevel).sum();
                    int reorder = Math.max(batches.stream().mapToInt(Medicine::getReorderLevel).max().orElse(0), 10);
                    return total <= reorder;
                })
                .count();

        long expired      = medicineRepository.findExpiredMedicines(today).size();
        long expiringSoon = medicineRepository.findExpiringSoonMedicines(today, today.plusDays(30)).size();
        long totalMeds    = groupedBySku.size();

        // ── 6. Recent Sales ───────────────────────────────────────────────
        List<Sale> recentSales = saleRepository.findTop10ByOrderBySaleDateDesc();

        // ── 7. 7-Day Revenue Chart ────────────────────────────────────────
        List<DashboardStats.ChartPoint> chartData = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            Double dailyRevenue = saleRepository.sumRevenueBetween(
                    date.atStartOfDay(), date.atTime(23, 59, 59));
            String dayName = date.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
            chartData.add(new DashboardStats.ChartPoint(dayName, nvl(dailyRevenue)));
        }

        return DashboardStats.builder()
                .totalRevenueToday(revenueToday)
                .grossProfitToday(grossProfitToday)
                .totalExpensesToday(expensesToday)
                .netProfitToday(netProfitToday)
                .monthlyGrossProfit(monthlyGross)
                .monthlyExpenses(expensesMonth)
                .monthlyNetProfit(monthlyNetProfit)
                .yearlyNetProfit(yearlyNetProfit)
                .lowStockCount(lowStock)
                .expiredCount(expired)
                .expiringSoonCount(expiringSoon)
                .totalMedicines(totalMeds)
                .recentSales(recentSales)
                .revenueChartData(chartData)
                .build();
    }

    private double calculateGrossProfit(List<Sale> sales) {
        double grossProfitSum = 0.0;

        for (Sale sale : sales) {
            if (sale == null || sale.getItems() == null) continue;

            double totalItemsSubtotal = sale.getItems().stream()
                    .filter(Objects::nonNull)
                    .mapToDouble(item -> item.getSubtotal() != null ? item.getSubtotal() : 0.0)
                    .sum();
            double disc = sale.getDiscountAmount() != null ? sale.getDiscountAmount() : 0.0;

            for (SaleItem item : sale.getItems()) {
                if (item == null) continue;

                double itemSubtotal = item.getSubtotal() != null ? item.getSubtotal() : 0.0;
                double itemProportionalDiscount = totalItemsSubtotal > 0.0 
                        ? (itemSubtotal / totalItemsSubtotal) * disc : 0.0;
                double itemNetRevenue = Math.max(0.0, itemSubtotal - itemProportionalDiscount);

                double unitCost = 0.0;
                String sku = "";

                Optional<Medicine> medOpt = medicineRepository.findById(item.getMedicineId());
                if (medOpt.isPresent()) {
                    Medicine med = medOpt.get();
                    sku = med.getSku() != null ? med.getSku() : "";
                    unitCost = med.getCostPrice() != null ? med.getCostPrice() : 0.0;
                }

                if (sku.isEmpty() && medOpt.isPresent()) {
                    sku = medOpt.get().getSku();
                }

                if (sku == null || sku.isEmpty()) {
                    sku = "SKU-" + item.getMedicineName().replaceAll("[^A-Za-z0-9]", "").toUpperCase();
                }

                double singleCost = unitCost;
                Optional<MedicineMaster> masterOpt = medicineMasterRepository.findFirstByProductCodeAndActiveTrue(sku);
                if (masterOpt.isPresent()) {
                    MedicineMaster mm = masterOpt.get();
                    String type = mm.getProductType() != null ? mm.getProductType().toLowerCase() : "";
                    if (type.contains("tablet") || type.contains("capsule")) {
                        int packSize = 10;
                        String qtyStr = mm.getProductQuantity();
                        if (qtyStr != null) {
                            java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\d+)").matcher(qtyStr);
                            if (matcher.find()) {
                                packSize = Integer.parseInt(matcher.group(1));
                            }
                        }
                        if (packSize > 0) {
                            singleCost = unitCost / packSize;
                        }
                    }
                } else {
                    if (singleCost == 0.0) {
                        singleCost = item.getUnitPrice() != null ? item.getUnitPrice() * 0.70 : 0.0;
                    }
                }

                double totalCost = singleCost * (item.getQuantity() != null ? item.getQuantity() : 0);
                double itemProfit = itemNetRevenue - totalCost;
                grossProfitSum += itemProfit;
            }
        }

        return grossProfitSum;
    }

    private double nvl(Double v) { return v != null ? v : 0.0; }
}
