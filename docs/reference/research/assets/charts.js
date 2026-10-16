(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var danger = style.getPropertyValue('--danger').trim();
  var ok = style.getPropertyValue('--ok').trim();
  var warm = style.getPropertyValue('--warm').trim();
  var accent3 = style.getPropertyValue('--accent3').trim();

  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: true,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables: {
        background: '#111722',
        primaryColor: '#17202e',
        primaryTextColor: '#d8e1ec',
        primaryBorderColor: '#4da3ff',
        lineColor: '#8494a8',
        secondaryColor: '#1c2a3d',
        tertiaryColor: '#17202e',
        clusterBkg: '#131a22',
        edgeLabelBackground: '#17202e',
        fontSize: '14px'
      },
      flowchart: { curve: 'basis', htmlLabels: true }
    });
  }

  var baseText = { color: ink, fontFamily: 'Outfit, PingFang SC, Microsoft YaHei, sans-serif' };
  var axisCommon = {
    axisLine: { lineStyle: { color: rule } },
    axisTick: { show: false },
    axisLabel: { color: muted, fontSize: 11 },
    splitLine: { lineStyle: { color: rule, opacity: 0.5 } }
  };

  function mk(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    return echarts.init(el, null, { renderer: 'svg' });
  }

  /* ---------- Chart 1: 市场规模 ---------- */
  var c1 = mk('chartScale');
  if (c1) {
    c1.setOption({
      animation: false,
      grid: { left: 50, right: 20, top: 40, bottom: 36 },
      tooltip: { trigger: 'axis', appendToBody: true, backgroundColor: bg2, borderColor: rule, textStyle: { color: ink } },
      xAxis: { type: 'category', data: ['2023', '2024', '2025', '2026E'], axisLine: axisCommon.axisLine, axisTick: { show: false }, axisLabel: { color: muted, fontSize: 12 } },
      yAxis: { type: 'value', name: '亿元', nameTextStyle: { color: muted, fontSize: 11 }, axisLabel: axisCommon.axisLabel, splitLine: axisCommon.splitLine },
      series: [{
        type: 'bar',
        barWidth: '46%',
        data: [
          { value: 199.14, itemStyle: { color: accent, opacity: 0.75 } },
          { value: 398.36, itemStyle: { color: accent, opacity: 0.88 } },
          { value: 535.35, itemStyle: { color: accent } },
          { value: 700, itemStyle: { color: accent2, opacity: 0.85 } }
        ],
        label: { show: true, position: 'top', color: ink, fontSize: 12, fontWeight: 600, formatter: function (p) { return p.value.toFixed(0); } }
      }]
    });
    window.addEventListener('resize', function () { c1.resize(); });
  }

  /* ---------- Chart 2: IAA/IAP 结构 ---------- */
  var c2 = mk('chartMix');
  if (c2) {
    c2.setOption({
      animation: false,
      tooltip: { trigger: 'item', appendToBody: true, backgroundColor: bg2, borderColor: rule, textStyle: { color: ink }, formatter: '{b}<br/>{c} 亿元（{d}%）' },
      legend: { bottom: 0, textStyle: { color: muted, fontSize: 12 }, itemWidth: 14, itemHeight: 14 },
      series: [{
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['50%', '46%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: bg2, borderWidth: 3, borderRadius: 6 },
        label: { color: ink, fontSize: 12, formatter: '{b}\n{d}%' },
        labelLine: { lineStyle: { color: rule } },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: 700 } },
        data: [
          { value: 170.71, name: 'IAA 广告变现', itemStyle: { color: accent2 } },
          { value: 364.64, name: 'IAP 内购', itemStyle: { color: accent } }
        ]
      }, {
        type: 'pie',
        radius: ['0%', '0%'],
        center: ['50%', '46%'],
        label: { show: true, position: 'center', color: ink, fontSize: 15, fontWeight: 700, formatter: '2025\n535 亿元' },
        silent: true,
        data: [{ value: 1 }]
      }]
    });
    window.addEventListener('resize', function () { c2.resize(); });
  }

  /* ---------- Chart 3: 品类红蓝海气泡图 ---------- */
  var c3 = mk('chartSector');
  if (c3) {
    var sectors = [
      { name: '传奇/MMO', x: 9.4, y: 2.0, size: 58, color: danger },
      { name: 'SLG', x: 8.8, y: 4.0, size: 62, color: danger },
      { name: '消除(纯玩法)', x: 8.6, y: 3.0, size: 66, color: danger },
      { name: '休闲', x: 8.2, y: 1.8, size: 64, color: danger },
      { name: '塔防', x: 7.6, y: 5.6, size: 46, color: warm },
      { name: '卡牌', x: 7.0, y: 2.2, size: 40, color: danger },
      { name: '放置(重度)', x: 6.8, y: 4.8, size: 44, color: warm },
      { name: '跑酷', x: 5.0, y: 4.0, size: 26, color: muted },
      { name: '二合/融合消除', x: 5.2, y: 8.0, size: 36, color: accent },
      { name: '模拟经营', x: 4.0, y: 9.4, size: 52, color: ok },
      { name: '物理解谜细分', x: 3.4, y: 7.2, size: 34, color: ok },
      { name: '文字×肉鸽融合', x: 2.8, y: 8.4, size: 30, color: ok },
      { name: '答题', x: 2.4, y: 6.2, size: 26, color: ok }
    ];
    c3.setOption({
      animation: false,
      grid: { left: 60, right: 40, top: 40, bottom: 56 },
      tooltip: {
        trigger: 'item', appendToBody: true, backgroundColor: bg2, borderColor: rule, textStyle: { color: ink },
        formatter: function (p) { return p.data.name + '<br/>竞争烈度 ' + p.data.x.toFixed(1) + ' / 增长机会 ' + p.data.y.toFixed(1); }
      },
      xAxis: {
        type: 'value', min: 0, max: 10, name: '买量竞争烈度 →', nameLocation: 'end',
        nameTextStyle: { color: muted, fontSize: 11 },
        axisLabel: axisCommon.axisLabel, splitLine: { show: false }, axisLine: axisCommon.axisLine
      },
      yAxis: {
        type: 'value', min: 0, max: 10, name: '增长机会 →', nameLocation: 'end',
        nameTextStyle: { color: muted, fontSize: 11 },
        axisLabel: axisCommon.axisLabel, splitLine: { show: false }, axisLine: axisCommon.axisLine
      },
      series: [
        {
          type: 'scatter',
          symbolSize: function (d) { return d[2]; },
          data: sectors.map(function (s) { return { value: [s.x, s.y, s.size], name: s.name, itemStyle: { color: s.color, opacity: 0.82, borderColor: s.color, borderWidth: 1 } }; }),
          label: {
            show: true,
            position: 'top',
            color: ink, fontSize: 11, fontWeight: 600,
            formatter: function (p) { return p.data.name; }
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: rule, type: 'dashed' },
            label: { show: false },
            data: [{ xAxis: 6 }, { yAxis: 6 }]
          },
          markArea: {
            silent: true,
            itemStyle: { color: 'rgba(94,207,149,0.05)' },
            data: [[{ xAxis: 0, yAxis: 6 }, { xAxis: 6, yAxis: 10 }]]
          }
        }
      ],
      graphic: [
        { type: 'text', left: '58%', top: '6%', style: { text: '目标区：低烈度 × 高增长', fill: ok, fontSize: 12, fontWeight: 600 } },
        { type: 'text', right: 40, bottom: '6%', style: { text: '红海：高烈度买量战', fill: danger, fontSize: 12, fontWeight: 600 } }
      ]
    });
    window.addEventListener('resize', function () { c3.resize(); });
  }

  /* ---------- Chart 4: 获客成本对比 ---------- */
  var c4 = mk('chartCPA');
  if (c4) {
    c4.setOption({
      animation: false,
      grid: { left: 130, right: 70, top: 44, bottom: 30 },
      tooltip: { trigger: 'item', appendToBody: true, backgroundColor: bg2, borderColor: rule, textStyle: { color: ink }, formatter: function (p) { return p.name + '<br/>' + p.value + ' 元'; } },
      legend: { top: 0, textStyle: { color: muted, fontSize: 11 }, itemWidth: 12, itemHeight: 12 },
      xAxis: { type: 'log', logBase: 10, min: 1, max: 5000, axisLabel: { color: muted, fontSize: 11, formatter: '{value}' }, axisLine: axisCommon.axisLine, splitLine: axisCommon.splitLine },
      yAxis: { type: 'category', data: ['模拟经营注册CPA\n(优化后)', '模拟经营注册CPA\n(优化前)', '塔防付费用户', 'SLG付费用户'], axisLabel: { color: ink, fontSize: 11 }, axisLine: axisCommon.axisLine },
      series: [{
        type: 'bar',
        barWidth: '52%',
        label: { show: true, position: 'right', color: ink, fontSize: 12, fontWeight: 600, formatter: '{c} 元' },
        data: [
          { value: 5, itemStyle: { color: ok } },
          { value: 15, itemStyle: { color: ok, opacity: 0.6 } },
          { value: 900, itemStyle: { color: accent2 } },
          { value: 4000, itemStyle: { color: danger } }
        ]
      }]
    });
    window.addEventListener('resize', function () { c4.resize(); });
  }

  /* ---------- Chart 5: 留存基准区间 ---------- */
  var c5 = mk('chartRetention');
  if (c5) {
    var items = [
      { name: '次留 · 超休闲头部厂商', min: 50, max: 60, type: 'd1' },
      { name: '次留 · 合成类健康区间', min: 35, max: 45, type: 'd1' },
      { name: '次留 · 原生手游"四二一"基准', min: 40, max: 40, type: 'd1' },
      { name: '次留 · 超休闲中小团队', min: 30, max: 40, type: 'd1' },
      { name: '7留 · 微信小游戏中位数', min: 24.8, max: 24.8, type: 'd7' },
      { name: '7留 · 原生手游"四二一"基准', min: 20, max: 20, type: 'd7' },
      { name: '7留 · 抖音小游戏中位数', min: 11.3, max: 11.3, type: 'd7' }
    ];
    c5.setOption({
      animation: false,
      grid: { left: 210, right: 60, top: 16, bottom: 34 },
      tooltip: {
        trigger: 'item', appendToBody: true, backgroundColor: bg2, borderColor: rule, textStyle: { color: ink },
        formatter: function (p) {
          var d = items[p.dataIndex];
          return d.name + '<br/>' + (d.min === d.max ? d.min + '%' : d.min + '% - ' + d.max + '%');
        }
      },
      xAxis: { type: 'value', max: 70, axisLabel: { color: muted, fontSize: 11, formatter: '{value}%' }, axisLine: axisCommon.axisLine, splitLine: axisCommon.splitLine },
      yAxis: { type: 'category', data: items.map(function (i) { return i.name; }), axisLabel: { color: ink, fontSize: 11 }, axisLine: axisCommon.axisLine },
      series: [{
        type: 'bar',
        stack: 'r',
        barWidth: '55%',
        itemStyle: { color: 'transparent' },
        silent: true,
        data: items.map(function (i) { return i.min; })
      }, {
        type: 'bar',
        stack: 'r',
        barWidth: '55%',
        label: {
          show: true, position: 'right', color: ink, fontSize: 11, fontWeight: 600,
          formatter: function (p) {
            var d = items[p.dataIndex];
            return d.min === d.max ? d.min + '%' : d.min + '-' + d.max + '%';
          }
        },
        data: items.map(function (i) {
          var span = i.max - i.min;
          return { value: span === 0 ? 0.8 : span, itemStyle: { color: i.type === 'd1' ? accent : accent2 } };
        })
      }]
    });
    window.addEventListener('resize', function () { c5.resize(); });
  }

  /* ---------- Chart 6: 五赛道雷达图 ---------- */
  var c6 = mk('chartRadar');
  if (c6) {
    c6.setOption({
      animation: false,
      tooltip: { trigger: 'item', appendToBody: true, backgroundColor: bg2, borderColor: rule, textStyle: { color: ink } },
      legend: { bottom: 0, textStyle: { color: muted, fontSize: 11 }, itemWidth: 12, itemHeight: 12 },
      radar: {
        indicator: [
          { name: '开发成本可控', max: 10 },
          { name: '留存潜力', max: 10 },
          { name: '裂变潜力', max: 10 },
          { name: 'IAA变现密度', max: 10 },
          { name: '竞争缓和度', max: 10 }
        ],
        center: ['50%', '48%'],
        radius: '62%',
        axisName: { color: ink, fontSize: 11 },
        splitLine: { lineStyle: { color: rule } },
        splitArea: { areaStyle: { color: ['rgba(23,32,46,0.3)', 'rgba(23,32,46,0.15)'] } },
        axisLine: { lineStyle: { color: rule } }
      },
      series: [{
        type: 'radar',
        symbolSize: 4,
        lineStyle: { width: 2 },
        data: [
          { value: [9, 6, 8, 7, 8], name: '01 文字×肉鸽×梗', itemStyle: { color: accent2 }, areaStyle: { opacity: 0.1, color: accent2 } },
          { value: [6, 9, 6, 6, 7], name: '02 治愈模拟经营', itemStyle: { color: ok }, areaStyle: { opacity: 0.1, color: ok } },
          { value: [7, 7, 6, 9, 6], name: '03 物理解谜细分', itemStyle: { color: accent }, areaStyle: { opacity: 0.1, color: accent } },
          { value: [7, 8, 7, 9, 5], name: '04 合成×经营', itemStyle: { color: accent3 }, areaStyle: { opacity: 0.1, color: accent3 } },
          { value: [9, 5, 9, 6, 7], name: '05 垂直答题PK', itemStyle: { color: danger }, areaStyle: { opacity: 0.1, color: danger } }
        ]
      }]
    });
    window.addEventListener('resize', function () { c6.resize(); });
  }
})();
