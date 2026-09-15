"""Versioned fictional Indian enterprise dataset. Operational metrics are never seeded."""

from intelligence.models import Principal

DATASET_VERSION = "india-electronics-2026.1"
PEOPLE = [
    Principal(
        user_id="ananya",
        name="Ananya Rao",
        email="ananya.rao@northstar.example",
        tenant_id="northstar",
        organization="Northstar Electronics India",
        role="analyst",
        job_title="Product Insights Lead",
        department="Product Strategy",
    ),
    Principal(
        user_id="rahul",
        name="Rahul Menon",
        email="rahul.menon@northstar.example",
        tenant_id="northstar",
        organization="Northstar Electronics India",
        role="support",
        job_title="Customer Experience Manager",
        department="Customer Operations",
    ),
    Principal(
        user_id="meera",
        name="Meera Shah",
        email="meera.shah@northstar.example",
        tenant_id="northstar",
        organization="Northstar Electronics India",
        role="finance",
        job_title="Finance Business Partner",
        department="Finance",
    ),
    Principal(
        user_id="arjun",
        name="Arjun Iyer",
        email="arjun.iyer@northstar.example",
        tenant_id="northstar",
        organization="Northstar Electronics India",
        role="administrator",
        job_title="Platform Operations Lead",
        department="Platform Engineering",
    ),
    Principal(
        user_id="kavya",
        name="Kavya Nair",
        email="kavya.nair@meridian.example",
        tenant_id="meridian",
        organization="Meridian Retail Systems",
        role="analyst",
        job_title="Business Intelligence Manager",
        department="Commercial Analytics",
    ),
    Principal(
        user_id="ishaan",
        name="Ishaan Desai",
        email="ishaan.desai@northstar.example",
        tenant_id="northstar",
        organization="Northstar Electronics India",
        role="platform_engineer",
        job_title="Cloud Platform Engineer",
        department="Platform Engineering",
    ),
    Principal(
        user_id="sana",
        name="Sana Khan",
        email="sana.khan@northstar.example",
        tenant_id="northstar",
        organization="Northstar Electronics India",
        role="developer",
        job_title="Application Engineer",
        department="Engineering",
    ),
    Principal(
        user_id="vikram",
        name="Vikram Joshi",
        email="vikram.joshi@northstar.example",
        tenant_id="northstar",
        organization="Northstar Electronics India",
        role="viewer",
        job_title="Regional Sales Manager",
        department="Sales",
    ),
]
PRODUCTS = [
    ("p1", "Atlas Pro 14", "Computing", 12000000, 8640000, "Battery overheating", 42),
    ("p2", "Orbit View 27", "Displays", 8000000, 6400000, "Display flickering", 28),
    ("p3", "Pulse Wireless", "Audio", 4000000, 4600000, "Bluetooth connectivity", 12),
    ("p4", "Nova Tab 11", "Tablets", 6000000, 5700000, "Charging intermittently", 8),
    ("p5", "Core Dock USB-C", "Accessories", 2200000, 2680000, "Port recognition", 5),
    ("p6", "Focus Cam HD", "Accessories", 1800000, 2040000, "Video quality", 4),
]
REGIONS = [("West", "Mumbai", 40), ("South", "Bengaluru", 35), ("North", "Delhi NCR", 25)]


def seed(db):
    for tenant, numerator, denominator in [("northstar", 1, 1), ("meridian", 3, 5)]:
        for pid, name, category, q1, q2, complaint, count in PRODUCTS:
            for quarter, total in [(0, q1), (1, q2)]:
                paise = total * 100 * numerator // denominator
                monthly = [paise * 31 // 100, paise * 34 // 100]
                monthly.append(paise - sum(monthly))
                for offset, amount in enumerate(monthly):
                    allocations = [amount * 40 // 100, amount * 35 // 100]
                    allocations.append(amount - sum(allocations))
                    for (region, city, _), revenue in zip(REGIONS, allocations):
                        units = max(1, revenue // (6500000 if pid == "p1" else 1800000))
                        db.execute(
                            "INSERT INTO sales VALUES (?,?,?,?,?,?,?,?,?)",
                            (
                                tenant,
                                pid,
                                name,
                                category,
                                f"2026-{quarter * 3 + offset + 1:02d}-15",
                                region,
                                city,
                                revenue,
                                units,
                            ),
                        )
            for i in range(count * numerator // denominator):
                db.execute(
                    "INSERT INTO tickets VALUES (?,?,?,?,?,?,?)",
                    (
                        f"{tenant}-{pid}-{i:04d}",
                        tenant,
                        pid,
                        complaint,
                        f"2026-{4 + i % 3:02d}-{1 + i % 27:02d}",
                        REGIONS[i % 3][0],
                        "High" if pid == "p1" else "Normal",
                    ),
                )
            db.execute(
                "INSERT INTO policies VALUES (?,?,?,?,?,?,?)",
                (
                    tenant,
                    pid,
                    f"{tenant}-{pid}-warranty-v1",
                    f"{name} · Limited warranty, section 2",
                    (
                        "Manufacturing defects are covered for 12 months from the invoice date. "
                        "Accidental damage, liquid ingress and unauthorised repairs are excluded. "
                        "A valid purchase invoice and authorised service inspection are required; "
                        "a complaint category alone does not establish coverage."
                    ),
                    "2026-01-01",
                    "2027-01-01",
                ),
            )
