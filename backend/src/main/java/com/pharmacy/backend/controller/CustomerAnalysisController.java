package com.pharmacy.backend.controller;

import com.pharmacy.backend.model.*;
import com.pharmacy.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/customer-analysis")
public class CustomerAnalysisController {

    @Autowired
    private SaleRepository saleRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @GetMapping("/summary")
    public CustomerAnalysisSummary getCustomerAnalysisSummary(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        List<Sale> allSales = saleRepository.findAll();
        List<Customer> allCustomers = customerRepository.findByActiveTrue();

        // Group sales by customer phone
        Map<String, List<Sale>> salesByPhone = new HashMap<>();
        double walkInSpend = 0.0;
        long walkInCount = 0;

        for (Sale sale : allSales) {
            String phone = sale.getPatientPhone();
            if (phone == null || phone.trim().isEmpty()) {
                walkInSpend += sale.getFinalAmount();
                walkInCount++;
            } else {
                String cleanPhone = phone.trim();
                salesByPhone.computeIfAbsent(cleanPhone, k -> new ArrayList<>()).add(sale);
            }
        }

        List<CustomerLeaderboardRow> leaderboard = new ArrayList<>();
        Map<String, List<String>> topMedicinesMap = new HashMap<>();

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

        long highSpenders = 0;
        long regularSpenders = 0;
        long casualSpenders = 0;
        double totalRegisteredSpend = 0.0;

        for (Customer customer : allCustomers) {
            String phone = customer.getPhone().trim();
            List<Sale> customerSales = salesByPhone.getOrDefault(phone, new ArrayList<>());

            double totalSpent = 0.0;
            String lastVisit = "—";
            java.time.LocalDateTime lastVisitDateTime = null;

            for (Sale s : customerSales) {
                totalSpent += s.getFinalAmount();
                if (lastVisitDateTime == null || s.getSaleDate().isAfter(lastVisitDateTime)) {
                    lastVisitDateTime = s.getSaleDate();
                }
            }

            if (lastVisitDateTime != null) {
                lastVisit = lastVisitDateTime.format(formatter);
            }

            int visits = customerSales.size();
            double aov = visits > 0 ? totalSpent / visits : 0.0;

            CustomerLeaderboardRow row = new CustomerLeaderboardRow();
            row.setName(customer.getName());
            row.setPhone(customer.getPhone());
            row.setAddress(customer.getAddress() != null ? customer.getAddress() : "—");
            row.setTotalSpent(totalSpent);
            row.setVisitCount(visits);
            row.setAverageOrderValue(aov);
            row.setLastVisitDate(lastVisit);

            leaderboard.add(row);
            totalRegisteredSpend += totalSpent;

            // Segment counting
            if (totalSpent > 500.0) {
                highSpenders++;
            } else if (totalSpent >= 200.0) {
                regularSpenders++;
            } else {
                casualSpenders++;
            }

            // Calculate top medicines purchased by this customer
            Map<String, Integer> medicineQtyMap = new HashMap<>();
            for (Sale s : customerSales) {
                if (s.getItems() != null) {
                    for (SaleItem item : s.getItems()) {
                        medicineQtyMap.put(item.getMedicineName(), 
                                           medicineQtyMap.getOrDefault(item.getMedicineName(), 0) + item.getQuantity());
                    }
                }
            }

            List<String> topMeds = medicineQtyMap.entrySet().stream()
                    .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue()))
                    .limit(3)
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toList());

            topMedicinesMap.put(phone, topMeds);
        }

        // Sort leaderboard by total spent descending
        leaderboard.sort((r1, r2) -> Double.compare(r2.getTotalSpent(), r1.getTotalSpent()));

        CustomerAnalysisSummary summary = new CustomerAnalysisSummary();
        summary.setTotalRegisteredCustomers(allCustomers.size());
        summary.setTotalRegisteredSpend(totalRegisteredSpend);
        summary.setTotalWalkInSpend(walkInSpend);
        summary.setTotalTransactions(allSales.size());
        summary.setRegisteredTransactions(allSales.size() - walkInCount);
        summary.setHighSpendersCount(highSpenders);
        summary.setRegularSpendersCount(regularSpenders);
        summary.setCasualSpendersCount(casualSpenders);
        summary.setLeaderboard(leaderboard);
        summary.setTopMedicinesByCustomer(topMedicinesMap);

        return summary;
    }

    public static class CustomerAnalysisSummary {
        private long totalRegisteredCustomers;
        private double totalRegisteredSpend;
        private double totalWalkInSpend;
        private long totalTransactions;
        private long registeredTransactions;
        private long highSpendersCount;
        private long regularSpendersCount;
        private long casualSpendersCount;
        private List<CustomerLeaderboardRow> leaderboard;
        private Map<String, List<String>> topMedicinesByCustomer;

        // Getters and Setters
        public long getTotalRegisteredCustomers() { return totalRegisteredCustomers; }
        public void setTotalRegisteredCustomers(long totalRegisteredCustomers) { this.totalRegisteredCustomers = totalRegisteredCustomers; }

        public double getTotalRegisteredSpend() { return totalRegisteredSpend; }
        public void setTotalRegisteredSpend(double totalRegisteredSpend) { this.totalRegisteredSpend = totalRegisteredSpend; }

        public double getTotalWalkInSpend() { return totalWalkInSpend; }
        public void setTotalWalkInSpend(double totalWalkInSpend) { this.totalWalkInSpend = totalWalkInSpend; }

        public long getTotalTransactions() { return totalTransactions; }
        public void setTotalTransactions(long totalTransactions) { this.totalTransactions = totalTransactions; }

        public long getRegisteredTransactions() { return registeredTransactions; }
        public void setRegisteredTransactions(long registeredTransactions) { this.registeredTransactions = registeredTransactions; }

        public long getHighSpendersCount() { return highSpendersCount; }
        public void setHighSpendersCount(long highSpendersCount) { this.highSpendersCount = highSpendersCount; }

        public long getRegularSpendersCount() { return regularSpendersCount; }
        public void setRegularSpendersCount(long regularSpendersCount) { this.regularSpendersCount = regularSpendersCount; }

        public long getCasualSpendersCount() { return casualSpendersCount; }
        public void setCasualSpendersCount(long casualSpendersCount) { this.casualSpendersCount = casualSpendersCount; }

        public List<CustomerLeaderboardRow> getLeaderboard() { return leaderboard; }
        public void setLeaderboard(List<CustomerLeaderboardRow> leaderboard) { this.leaderboard = leaderboard; }

        public Map<String, List<String>> getTopMedicinesByCustomer() { return topMedicinesByCustomer; }
        public void setTopMedicinesByCustomer(Map<String, List<String>> topMedicinesByCustomer) { this.topMedicinesByCustomer = topMedicinesByCustomer; }
    }

    public static class CustomerLeaderboardRow {
        private String name;
        private String phone;
        private String address;
        private double totalSpent;
        private int visitCount;
        private double averageOrderValue;
        private String lastVisitDate;

        // Getters and Setters
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }

        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }

        public double getTotalSpent() { return totalSpent; }
        public void setTotalSpent(double totalSpent) { this.totalSpent = totalSpent; }

        public int getVisitCount() { return visitCount; }
        public void setVisitCount(int visitCount) { this.visitCount = visitCount; }

        public double getAverageOrderValue() { return averageOrderValue; }
        public void setAverageOrderValue(double averageOrderValue) { this.averageOrderValue = averageOrderValue; }

        public String getLastVisitDate() { return lastVisitDate; }
        public void setLastVisitDate(String lastVisitDate) { this.lastVisitDate = lastVisitDate; }
    }
}
