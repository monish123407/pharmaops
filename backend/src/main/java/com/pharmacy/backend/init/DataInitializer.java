package com.pharmacy.backend.init;

import com.pharmacy.backend.model.*;
import com.pharmacy.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.util.Arrays;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired private UserRepository userRepository;
    @Autowired private MedicineRepository medicineRepository;
    @Autowired private MedicineMasterRepository medicineMasterRepository;
    @Autowired private SupplierRepository supplierRepository;
    @Autowired private PrescriptionRepository prescriptionRepository;
    @Autowired private SaleRepository saleRepository;
    @Autowired private CustomerRepository customerRepository;

    @Override
    public void run(String... args) throws Exception {
        System.out.println("====== PharmaOps Data Seeder Started ======");

        seedUsers();
        seedMedicineMasters();

        System.out.println("====== PharmaOps Seeder Complete ======");
    }

    // ─────────────────────────────────────────────────────
    //  1. USERS
    // ─────────────────────────────────────────────────────
    private void seedUsers() {
        if (userRepository.count() > 0) return;

        userRepository.saveAll(Arrays.asList(
            User.builder().username("admin").password("admin123")
                .fullName("Admin").email("admin@pharmacy.com").role(UserRole.ADMIN).build(),
            User.builder().username("pharmacist").password("pharmacist123")
                .fullName("Pharmacist").email("pharmacist@pharmacy.com").role(UserRole.PHARMACIST).build(),
            User.builder().username("cashier").password("cashier123")
                .fullName("Cashier").email("cashier@pharmacy.com").role(UserRole.CASHIER).build(),
            User.builder().username("manager").password("manager123")
                .fullName("Manager").email("manager@pharmacy.com").role(UserRole.INVENTORY_MANAGER).build()
        ));
        System.out.println("Users seeded.");
    }

    // ─────────────────────────────────────────────────────
    //  2. MEDICINE MASTER CATALOG
    //
    //  HSN Code Reference (India):
    //  3004 – Medicaments for human therapeutic use      (GST 12% general | 5% life-saving)
    //  3002 – Vaccines, blood products, immunologicals   (GST 5%)
    //  3003 – Medicaments (mixed, not in dosage)         (GST 12%)
    //  3305 – Preparations for hair                      (GST 18%)
    //  3304 – Beauty/skin preparations, cosmetics        (GST 18%)
    //  2106 – Food preparations/nutraceuticals           (GST 18%)
    //  3005 – Bandages, gauze, wound dressings           (GST 12%)
    //  3006 – Pharmaceutical preparations                (GST 12%)
    //
    //  Rack Layout:
    //  A – Antibiotics & Antimicrobials
    //  B – Analgesics, NSAIDs & Antipyretics
    //  C – Cardiovascular & Antihypertensives
    //  D – Antidiabetics & Hormones
    //  E – Gastrointestinal (GI) & Antacids
    //  F – Respiratory, Antihistamines & ENT
    //  G – Vitamins, Minerals & Nutraceuticals
    //  H – Dermatology & Topicals
    //  I – Eye & Ear Preparations
    //  J – Neurological & CNS
    //  FRIDGE – Refrigerated (Insulin, Vaccines)
    // ─────────────────────────────────────────────────────
    private void seedMedicineMasters() {
        if (medicineMasterRepository.count() > 0) return;

        medicineMasterRepository.saveAll(Arrays.asList(

            // ── SECTION A: ANTIBIOTICS & ANTIMICROBIALS ──────────────────
            MedicineMaster.builder()
                .productName("Amoxicillin 500mg")
                .composition("Amoxicillin Trihydrate IP 500mg")
                .productCode("MED-AMOX-500")
                .companyName("Cipla Ltd")
                .category("medicine").productType("Capsule")
                .productQuantity("10 Capsules/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("A-01").reorderLevel(50).build(),

            MedicineMaster.builder()
                .productName("Azithromycin 500mg")
                .composition("Azithromycin Dihydrate IP 500mg")
                .productCode("MED-AZIT-500")
                .companyName("Sun Pharma")
                .category("medicine").productType("Tablet")
                .productQuantity("3 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("A-02").reorderLevel(40).build(),

            MedicineMaster.builder()
                .productName("Ciprofloxacin 500mg")
                .composition("Ciprofloxacin HCl IP equivalent to Ciprofloxacin 500mg")
                .productCode("MED-CIPRO-500")
                .companyName("Lupin Ltd")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("A-03").reorderLevel(40).build(),

            MedicineMaster.builder()
                .productName("Cefixime 200mg")
                .composition("Cefixime Trihydrate IP 200mg")
                .productCode("MED-CEFIX-200")
                .companyName("Alkem Laboratories")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("A-04").reorderLevel(30).build(),

            MedicineMaster.builder()
                .productName("Metronidazole 400mg")
                .composition("Metronidazole IP 400mg")
                .productCode("MED-METRO-400")
                .companyName("Abbott India")
                .category("medicine").productType("Tablet")
                .productQuantity("15 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("A-05").reorderLevel(30).build(),

            MedicineMaster.builder()
                .productName("Doxycycline 100mg")
                .composition("Doxycycline Hyclate IP 100mg")
                .productCode("MED-DOXY-100")
                .companyName("Mankind Pharma")
                .category("medicine").productType("Capsule")
                .productQuantity("10 Capsules/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("A-06").reorderLevel(25).build(),

            // ── SECTION B: ANALGESICS, NSAIDs & ANTIPYRETICS ─────────────
            MedicineMaster.builder()
                .productName("Paracetamol 500mg")
                .composition("Paracetamol IP 500mg")
                .productCode("MED-PARA-500")
                .companyName("GlaxoSmithKline Pharmaceuticals")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("B-01").reorderLevel(100).build(),

            MedicineMaster.builder()
                .productName("Ibuprofen 400mg")
                .composition("Ibuprofen IP 400mg")
                .productCode("MED-IBU-400")
                .companyName("Bayer Zydus Pharma")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("B-02").reorderLevel(60).build(),

            MedicineMaster.builder()
                .productName("Diclofenac Sodium 50mg")
                .composition("Diclofenac Sodium IP 50mg")
                .productCode("MED-DICLO-50")
                .companyName("Novartis India")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("B-03").reorderLevel(50).build(),

            MedicineMaster.builder()
                .productName("Aceclofenac 100mg + Paracetamol 325mg")
                .composition("Aceclofenac IP 100mg + Paracetamol IP 325mg")
                .productCode("MED-ACECLO-PARA")
                .companyName("Torrent Pharmaceuticals")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("B-04").reorderLevel(50).build(),

            // ── SECTION C: CARDIOVASCULAR & ANTIHYPERTENSIVES ────────────
            MedicineMaster.builder()
                .productName("Atorvastatin 10mg")
                .composition("Atorvastatin Calcium IP equivalent to Atorvastatin 10mg")
                .productCode("MED-ATOR-10")
                .companyName("Pfizer Ltd")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("C-01").reorderLevel(40).build(),

            MedicineMaster.builder()
                .productName("Amlodipine 5mg")
                .composition("Amlodipine Besilate IP equivalent to Amlodipine 5mg")
                .productCode("MED-AMLO-5")
                .companyName("Pfizer Ltd")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("C-02").reorderLevel(40).build(),

            MedicineMaster.builder()
                .productName("Ramipril 5mg")
                .composition("Ramipril IP 5mg")
                .productCode("MED-RAMI-5")
                .companyName("Sanofi India")
                .category("medicine").productType("Capsule")
                .productQuantity("10 Capsules/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("C-03").reorderLevel(30).build(),

            MedicineMaster.builder()
                .productName("Metoprolol Succinate 25mg")
                .composition("Metoprolol Succinate IP 25mg (Extended Release)")
                .productCode("MED-METRO-SUC-25")
                .companyName("AstraZeneca India")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("C-04").reorderLevel(30).build(),

            MedicineMaster.builder()
                .productName("Aspirin 75mg")
                .composition("Aspirin IP 75mg (Dispersible)")
                .productCode("MED-ASPIRIN-75")
                .companyName("Bayer Zydus Pharma")
                .category("medicine").productType("Tablet")
                .productQuantity("14 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("C-05").reorderLevel(40).build(),

            MedicineMaster.builder()
                .productName("Telmisartan 40mg")
                .composition("Telmisartan IP 40mg")
                .productCode("MED-TELMI-40")
                .companyName("Glenmark Pharmaceuticals")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("C-06").reorderLevel(30).build(),

            // ── SECTION D: ANTIDIABETICS & HORMONES ──────────────────────
            // Note: Antidiabetics listed under 5% GST slab (life-saving)
            MedicineMaster.builder()
                .productName("Metformin Hydrochloride 500mg")
                .composition("Metformin Hydrochloride IP 500mg")
                .productCode("MED-METF-500")
                .companyName("USV Pvt Ltd")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(2.5).sgst(2.5)   // 5% GST – antidiabetic life-saving slab
                .rackLocation("D-01").reorderLevel(60).build(),

            MedicineMaster.builder()
                .productName("Glimepiride 2mg")
                .composition("Glimepiride IP 2mg")
                .productCode("MED-GLIM-2")
                .companyName("Sanofi India")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(2.5).sgst(2.5)   // 5% GST – antidiabetic life-saving slab
                .rackLocation("D-02").reorderLevel(40).build(),

            MedicineMaster.builder()
                .productName("Sitagliptin 50mg")
                .composition("Sitagliptin Phosphate Monohydrate IP equivalent to Sitagliptin 50mg")
                .productCode("MED-SITA-50")
                .companyName("MSD Pharmaceuticals")
                .category("medicine").productType("Tablet")
                .productQuantity("7 Tablets/Strip")
                .hsnCode("3004").cgst(2.5).sgst(2.5)   // 5% GST – antidiabetic
                .rackLocation("D-03").reorderLevel(25).build(),

            MedicineMaster.builder()
                .productName("Levothyroxine 50mcg")
                .composition("Levothyroxine Sodium IP 50mcg")
                .productCode("MED-LEVO-50")
                .companyName("Abbott India")
                .category("medicine").productType("Tablet")
                .productQuantity("30 Tablets/Strip")
                .hsnCode("3004").cgst(2.5).sgst(2.5)   // 5% GST – thyroid hormone
                .rackLocation("D-04").reorderLevel(20).build(),

            MedicineMaster.builder()
                .productName("Insulin Glargine 100 IU/mL")
                .composition("Insulin Glargine (rDNA) 100 IU/mL")
                .productCode("MED-INSU-GLAR")
                .companyName("Sanofi India")
                .category("medicine").productType("Injection")
                .productQuantity("1 Pen/3mL (300 IU)")
                .hsnCode("3004").cgst(2.5).sgst(2.5)   // 5% GST – insulin life-saving
                .rackLocation("FRIDGE-01").reorderLevel(10).build(),

            // ── SECTION E: GASTROINTESTINAL & ANTACIDS ───────────────────
            MedicineMaster.builder()
                .productName("Pantoprazole 40mg")
                .composition("Pantoprazole Sodium Sesquihydrate IP equivalent to Pantoprazole 40mg")
                .productCode("MED-PANTO-40")
                .companyName("Zydus Lifesciences")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("E-01").reorderLevel(50).build(),

            MedicineMaster.builder()
                .productName("Omeprazole 20mg")
                .composition("Omeprazole IP 20mg")
                .productCode("MED-OMEP-20")
                .companyName("Dr. Reddy's Laboratories")
                .category("medicine").productType("Capsule")
                .productQuantity("10 Capsules/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("E-02").reorderLevel(50).build(),

            MedicineMaster.builder()
                .productName("Ondansetron 4mg")
                .composition("Ondansetron Hydrochloride Dihydrate IP equivalent to Ondansetron 4mg")
                .productCode("MED-ONDAN-4")
                .companyName("Cipla Ltd")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("E-03").reorderLevel(30).build(),

            MedicineMaster.builder()
                .productName("Domperidone 10mg")
                .composition("Domperidone IP 10mg")
                .productCode("MED-DOMP-10")
                .companyName("Janssen India")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("E-04").reorderLevel(35).build(),

            MedicineMaster.builder()
                .productName("Syrup Lactulose 10g/15mL")
                .composition("Lactulose Solution IP 10g per 15mL")
                .productCode("MED-LACTU-SYR")
                .companyName("Abbott India")
                .category("medicine").productType("Syrup")
                .productQuantity("200mL Bottle")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("E-05").reorderLevel(15).build(),

            // ── SECTION F: RESPIRATORY, ANTIHISTAMINES & ENT ─────────────
            MedicineMaster.builder()
                .productName("Cetirizine 10mg")
                .composition("Cetirizine Hydrochloride IP 10mg")
                .productCode("MED-CETIR-10")
                .companyName("UCB India")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("F-01").reorderLevel(50).build(),

            MedicineMaster.builder()
                .productName("Montelukast 10mg")
                .composition("Montelukast Sodium IP equivalent to Montelukast 10mg")
                .productCode("MED-MONTL-10")
                .companyName("Merck India")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("F-02").reorderLevel(30).build(),

            MedicineMaster.builder()
                .productName("Salbutamol 2mg")
                .composition("Salbutamol Sulphate IP equivalent to Salbutamol 2mg")
                .productCode("MED-SALBU-2")
                .companyName("GlaxoSmithKline Pharmaceuticals")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("F-03").reorderLevel(25).build(),

            MedicineMaster.builder()
                .productName("Ambroxol Hydrochloride 30mg")
                .composition("Ambroxol Hydrochloride IP 30mg")
                .productCode("MED-AMBRO-30")
                .companyName("Boehringer Ingelheim India")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("F-04").reorderLevel(30).build(),

            MedicineMaster.builder()
                .productName("Budesonide 200mcg Inhaler")
                .composition("Budesonide IP 200mcg per actuation")
                .productCode("MED-BUDES-INH")
                .companyName("AstraZeneca India")
                .category("medicine").productType("Inhaler")
                .productQuantity("200 Doses/Inhaler")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("F-05").reorderLevel(10).build(),

            // ── SECTION G: VITAMINS, MINERALS & NUTRACEUTICALS ───────────
            // Note: Nutraceuticals/food supplements: HSN 2106, GST 18%
            MedicineMaster.builder()
                .productName("Vitamin D3 60000 IU")
                .composition("Cholecalciferol IP 60000 IU")
                .productCode("VIT-D3-60K")
                .companyName("Sun Pharma")
                .category("medicine").productType("Soft Gelatin Capsule")
                .productQuantity("4 Capsules/Strip")
                .hsnCode("3004").cgst(2.5).sgst(2.5)   // 5% GST – vitamin D3 pharma
                .rackLocation("G-01").reorderLevel(30).build(),

            MedicineMaster.builder()
                .productName("Vitamin B Complex + Vitamin C")
                .composition("Thiamine 10mg + Riboflavin 10mg + Pyridoxine 3mg + Cyanocobalamin 15mcg + Nicotinamide 45mg + Ascorbic Acid 150mg")
                .productCode("VIT-BCOMPLEX-C")
                .companyName("Pfizer Ltd")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("G-02").reorderLevel(30).build(),

            MedicineMaster.builder()
                .productName("Calcium Carbonate 500mg + Vitamin D3 250 IU")
                .composition("Calcium Carbonate IP 1250mg (equivalent to Calcium 500mg) + Vitamin D3 IP 250 IU")
                .productCode("MIN-CALCI-D3")
                .companyName("Sanofi India")
                .category("medicine").productType("Tablet")
                .productQuantity("15 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("G-03").reorderLevel(25).build(),

            MedicineMaster.builder()
                .productName("Ferrous Sulphate 200mg + Folic Acid 0.5mg")
                .composition("Ferrous Sulphate IP 200mg + Folic Acid IP 0.5mg")
                .productCode("MIN-FE-FOLIC")
                .companyName("Elder Pharmaceuticals")
                .category("medicine").productType("Tablet")
                .productQuantity("30 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("G-04").reorderLevel(20).build(),

            MedicineMaster.builder()
                .productName("Omega-3 Fatty Acids 1000mg")
                .composition("EPA 180mg + DHA 120mg + Other Omega-3 Fatty Acids")
                .productCode("NUT-OMEGA3-1G")
                .companyName("Abbott India")
                .category("food").productType("Soft Gelatin Capsule")
                .productQuantity("30 Capsules/Bottle")
                .hsnCode("2106").cgst(9.0).sgst(9.0)   // HSN 2106 – food preparation, 18% GST
                .rackLocation("G-05").reorderLevel(15).build(),

            // ── SECTION H: DERMATOLOGY & TOPICALS ────────────────────────
            MedicineMaster.builder()
                .productName("Clotrimazole 1% Cream")
                .composition("Clotrimazole IP 1% w/w")
                .productCode("DRM-CLOTRI-CR")
                .companyName("Bayer Zydus Pharma")
                .category("medicine").productType("Cream")
                .productQuantity("15g Tube")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("H-01").reorderLevel(20).build(),

            MedicineMaster.builder()
                .productName("Mupirocin 2% Ointment")
                .composition("Mupirocin IP 2% w/w")
                .productCode("DRM-MUPIRO-OIN")
                .companyName("GlaxoSmithKline Pharmaceuticals")
                .category("medicine").productType("Ointment")
                .productQuantity("5g Tube")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("H-02").reorderLevel(15).build(),

            MedicineMaster.builder()
                .productName("Betamethasone 0.1% + Clotrimazole 1% Cream")
                .composition("Betamethasone Valerate IP 0.1% w/w + Clotrimazole IP 1% w/w")
                .productCode("DRM-BETA-CLOTRI")
                .companyName("Merck India")
                .category("medicine").productType("Cream")
                .productQuantity("20g Tube")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("H-03").reorderLevel(15).build(),

            // ── SECTION I: EYE & EAR PREPARATIONS ───────────────────────
            MedicineMaster.builder()
                .productName("Ciprofloxacin 0.3% Eye Drops")
                .composition("Ciprofloxacin Hydrochloride IP equivalent to Ciprofloxacin 0.3% w/v")
                .productCode("EYE-CIPRO-03")
                .companyName("Alcon Laboratories India")
                .category("medicine").productType("Eye Drops")
                .productQuantity("10mL Bottle")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("I-01").reorderLevel(15).build(),

            MedicineMaster.builder()
                .productName("Timolol Maleate 0.5% Eye Drops")
                .composition("Timolol Maleate IP equivalent to Timolol 0.5% w/v")
                .productCode("EYE-TIMOL-05")
                .companyName("Allergan India")
                .category("medicine").productType("Eye Drops")
                .productQuantity("5mL Bottle")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("I-02").reorderLevel(10).build(),

            MedicineMaster.builder()
                .productName("Sodium Chloride 0.9% Eye Drops")
                .composition("Sodium Chloride IP 0.9% w/v (Isotonic Saline)")
                .productCode("EYE-NACL-09")
                .companyName("Alcon Laboratories India")
                .category("medicine").productType("Eye Drops")
                .productQuantity("15mL Bottle")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("I-03").reorderLevel(10).build(),

            // ── SECTION J: NEUROLOGICAL & CNS ────────────────────────────
            MedicineMaster.builder()
                .productName("Gabapentin 300mg")
                .composition("Gabapentin IP 300mg")
                .productCode("CNS-GABAP-300")
                .companyName("Pfizer Ltd")
                .category("medicine").productType("Capsule")
                .productQuantity("10 Capsules/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("J-01").reorderLevel(20).build(),

            MedicineMaster.builder()
                .productName("Pregabalin 75mg")
                .composition("Pregabalin IP 75mg")
                .productCode("CNS-PREG-75")
                .companyName("Pfizer Ltd")
                .category("medicine").productType("Capsule")
                .productQuantity("10 Capsules/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("J-02").reorderLevel(20).build(),

            MedicineMaster.builder()
                .productName("Alprazolam 0.25mg")
                .composition("Alprazolam IP 0.25mg")
                .productCode("CNS-ALPRAZ-025")
                .companyName("Pfizer Ltd")
                .category("medicine").productType("Tablet")
                .productQuantity("10 Tablets/Strip")
                .hsnCode("3004").cgst(6.0).sgst(6.0)
                .rackLocation("J-03").reorderLevel(15).build(),

            // ── SURGICAL / WOUND CARE ─────────────────────────────────────
            MedicineMaster.builder()
                .productName("Povidone Iodine 5% Ointment")
                .composition("Povidone Iodine IP 5% w/w")
                .productCode("SUR-PVDI-OIN")
                .companyName("Win-Medicare Pvt Ltd")
                .category("medicine").productType("Ointment")
                .productQuantity("20g Tube")
                .hsnCode("3006").cgst(6.0).sgst(6.0)   // HSN 3006 – pharmaceutical preparations
                .rackLocation("H-04").reorderLevel(15).build(),

            MedicineMaster.builder()
                .productName("Crepe Bandage 10cm x 4m")
                .composition("Cotton Crepe Bandage")
                .productCode("SUR-CREPE-10")
                .companyName("Johnson & Johnson India")
                .category("others").productType("Bandage")
                .productQuantity("1 Roll")
                .hsnCode("3005").cgst(6.0).sgst(6.0)   // HSN 3005 – bandages, 12% GST
                .rackLocation("H-05").reorderLevel(20).build(),

            // ── ORS & IV FLUIDS ───────────────────────────────────────────
            MedicineMaster.builder()
                .productName("ORS Powder Sachet (WHO Formula)")
                .composition("Sodium Chloride 2.6g + Glucose Anhydrous 13.5g + Potassium Chloride 1.5g + Sodium Citrate 2.9g per sachet")
                .productCode("MED-ORS-WHO")
                .companyName("Electroral")
                .category("medicine").productType("Powder for Oral Solution")
                .productQuantity("21.8g/Sachet (1L solution)")
                .hsnCode("3004").cgst(2.5).sgst(2.5)   // 5% GST – ORS life-saving
                .rackLocation("E-06").reorderLevel(30).build()

        ));

        System.out.println("Medicine Masters seeded: " + medicineMasterRepository.count() + " entries.");
    }
}
