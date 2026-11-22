package com.pharmacy.backend.dto;

import com.pharmacy.backend.model.Sale;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardStats {
    private Double totalRevenueToday;
    private Double grossProfitToday;       // Revenue today (sales revenue)
    private Double totalExpensesToday;     // Shop expenses recorded today
    private Double netProfitToday;         // grossProfit - expenses (today)
    private Double monthlyGrossProfit;     // Revenue this month
    private Double monthlyExpenses;        // Expenses this month
    private Double monthlyNetProfit;       // monthlyGrossProfit - monthlyExpenses
    private Double yearlyNetProfit;        // Net profit for current year
    private Long lowStockCount;
    private Long expiredCount;
    private Long expiringSoonCount;
    private Long totalMedicines;
    private List<Sale> recentSales;
    private List<ChartPoint> revenueChartData;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChartPoint {
        private String label; // e.g. "Mon", "Tue" or "Jan", "Feb"
        private Double value;
    }
}
