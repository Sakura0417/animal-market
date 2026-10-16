/* ============================================================
 * 《动物集市》PRD 图表脚本
 * ============================================================ */
(function () {
  'use strict';
  if (typeof echarts === 'undefined') return;

  var charts = [];
  var AXIS = {
    axisLine: { lineStyle: { color: '#243040' } },
    axisLabel: { color: '#8494a8' },
    splitLine: { lineStyle: { color: 'rgba(36,48,64,.5)' } }
  };

  function mk(id, opt) {
    var el = document.getElementById(id);
    if (!el) return;
    var c = echarts.init(el);
    opt.textStyle = { fontFamily: 'Outfit, PingFang SC, Microsoft YaHei', color: '#8494a8' };
    opt.backgroundColor = 'transparent';
    c.setOption(opt);
    charts.push(c);
  }

  /* 图 5-1 难度曲线实测基线（BalanceSim，L1-L12 各 400 局） */
  var levels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'L11', 'L12'];
  var firstTrial = [100, 100, 99.5, 98.8, 97.0, 87.3, 83.8, 75.0, 65.0, 58.5, 53.3, 55.3];
  var recovered = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
  var crowdRate = [0, 0, 0.5, 1.3, 3.0, 12.8, 16.0, 25.0, 33.0, 40.0, 45.3, 43.5];
  mk('chartDifficulty', {
    grid: { left: 46, right: 24, top: 46, bottom: 30 },
    legend: { top: 4, textStyle: { color: '#8494a8' }, itemWidth: 14, itemHeight: 9 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category', data: levels,
      axisLine: AXIS.axisLine,
      axisLabel: { color: '#8494a8', interval: 0, fontSize: 10 }
    },
    yAxis: {
      type: 'value', min: 0, max: 100, name: '%',
      nameTextStyle: { color: '#8494a8' },
      axisLine: AXIS.axisLine, axisLabel: AXIS.axisLabel, splitLine: AXIS.splitLine
    },
    series: [
      {
        name: '围栏挤爆率', type: 'bar', barWidth: '42%', data: crowdRate,
        itemStyle: { color: 'rgba(239,122,112,.35)', borderRadius: [3, 3, 0, 0] }
      },
      {
        name: '一审通过率', type: 'line', data: firstTrial, smooth: false,
        symbol: 'circle', symbolSize: 7,
        lineStyle: { width: 2.5, color: '#f5b455' }, itemStyle: { color: '#f5b455' },
        label: { show: true, position: 'bottom', color: '#8494a8', fontSize: 9, formatter: '{c}%' },
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { color: '#ef7a70', type: 'dashed' },
          label: { color: '#ef7a70', formatter: '调整红线 50%' },
          data: [{ yAxis: 50 }]
        }
      },
      {
        name: '广告恢复后', type: 'line', data: recovered, smooth: false,
        symbol: 'circle', symbolSize: 5,
        lineStyle: { width: 2, color: '#5ecf95' }, itemStyle: { color: '#5ecf95' }
      }
    ]
  });

  /* 图 5-2 单用户单日广告容量分配 */
  mk('chartAdCapacity', {
    grid: { left: 96, right: 46, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '人均 {c} 次/日' },
    xAxis: {
      type: 'value', max: 1.5,
      axisLine: AXIS.axisLine, axisLabel: AXIS.axisLabel, splitLine: AXIS.splitLine
    },
    yAxis: {
      type: 'category',
      data: ['失败·清仓', '签到翻倍', '图鉴加速', '双倍金币', '失败·放生', '失败·复活', '吊车模式'],
      axisLine: AXIS.axisLine, axisLabel: { color: '#d8e1ec', fontSize: 11 }
    },
    series: [{
      type: 'bar', barWidth: '55%',
      data: [0.4, 0.5, 0.6, 0.8, 1.0, 1.1, 1.2].map(function (v, i) {
        return {
          value: v,
          itemStyle: { color: ['#5ecf95', '#4da3ff', '#4da3ff', '#4da3ff', '#f5b455', '#f5b455', '#f5b455'][i], borderRadius: [0, 4, 4, 0] }
        };
      }),
      label: { show: true, position: 'right', color: '#8494a8', fontSize: 10, formatter: '{c} 次' }
    }]
  });

  /* 图 7-1 留存基准与目标 */
  mk('chartRetention', {
    grid: { left: 52, right: 24, top: 56, bottom: 34 },
    legend: { top: 8, textStyle: { color: '#8494a8' }, itemWidth: 14, itemHeight: 9 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category', data: ['次日留存', '7 日留存'],
      axisLine: AXIS.axisLine, axisLabel: { color: '#d8e1ec', fontSize: 12 }
    },
    yAxis: {
      type: 'value', max: 50, name: '%',
      nameTextStyle: { color: '#8494a8' },
      axisLine: AXIS.axisLine, axisLabel: AXIS.axisLabel, splitLine: AXIS.splitLine
    },
    series: [
      {
        name: '品类健康基准', type: 'bar', barWidth: '30%', barGap: '40%',
        data: [35, 12],
        itemStyle: { color: '#8494a8', borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', color: '#8494a8', fontSize: 10, formatter: '{c}%' }
      },
      {
        name: '本产品验证目标', type: 'bar', barWidth: '30%',
        data: [35, 15],
        itemStyle: { color: '#5ecf95', borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', color: '#5ecf95', fontSize: 10, formatter: '{c}%' }
      }
    ]
  });

  window.addEventListener('resize', function () {
    charts.forEach(function (c) { c.resize(); });
  });
})();
