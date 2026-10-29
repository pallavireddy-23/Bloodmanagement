function inventoryAnalytics() {
  const counts = groups.map(group => ({
    group,
    units: data.blood_units.filter(
      u => u.blood_group === group && available(u)
    ).length
  }));

  const max = Math.max(...counts.map(c => c.units), 1);

  return `
    <section class="card analytics-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">LIVE ANALYTICS</span>
          <h2>Blood Inventory</h2>
        </div>
      </div>

      <div class="bar-chart">
        ${counts.map(c => `
          <div class="bar-item">
            <div class="bar-value">${c.units}</div>

            <div
              class="bar-fill"
              style="height:${(c.units/max)*180}px">
            </div>

            <span>${c.group}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}
