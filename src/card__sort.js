(function($) {

  function setCookie(name, value, dateExpires = 365) {
    const date = new Date();
    date.setTime(date.getTime() + (dateExpires * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + '=' + JSON.stringify(value) + '; ' + expires;
  }

  function getCookie(name) {
    try {
      return JSON.parse(document.cookie
        .split('; ')
        .find(row => row.startsWith(name + '='))
        .split('=')[1]);
    } catch (e) {
      return null;
    }
  }

  $(function() {
    
    $('.page--generate .cards:not(.cards--inited)').each(function() {
      var wrapper = $(this).addClass('cards--inited');
      var form = $('.form');
      var more = form.find('.form__more');
      var sort = form.find('.form__sorters .form__sort');
      var filters = form.find('.form__filters .form__input[type=text]');
      var properties = form.find('.form__filters .form__input[type=checkbox]');
      var info = form.find('.form__info');
      var cards = [];
      var do_update = true;

      wrapper.find('.card__grid').each(function() {
        var item = $(this);
        const card = {
          data: item.data(),
          html: item.prop('outerHTML'),
        };
        card.data.text = item.text();

        cards.push(card);
      });

      var update = function() {
        if (!do_update) return;
        var updated = 0;
        var cookiedata = {
          sort: 'serial__asc',
          filters: [],
          properties: [],
          open: more.prop('open'),
        };
        var [value, direction] = sort.val().split('__');
        cookiedata.sort = value + '__' + direction;

        cards.sort(function(a, b) {
          var va = a.data[value];
          var vb = b.data[value];

          if (direction === 'desc') {
            var s = vb;
            vb = va;
            va = s;
          }

          if (typeof va === 'string') {
            return va.localeCompare(vb);
          } else {
            return va - vb;
          }
        });

        wrapper.html('');
        var filter_values = [];
        filters.each(function() {
          const item = $(this);

          const filter = {
            type: 'filter',
            value: item.val(),
            original: item.val(),
            data: item.data('filter'),
          };

          const split = item.data('split');
          if (split !== undefined) {
            filter.value = filter.value.split(split);
          }

          cookiedata.filters.push(filter);
          filter_values.push(filter);
        });
        properties.each(function() {
          const item = $(this);

          if (item.is(':checked')) {
            const prop = {
              type: 'prop',
              value: item.val().split('__')[0],
              original: item.val(),
              data: item.val().split('__')[1],
            };
  
            cookiedata.properties.push(prop);
            filter_values.push(prop);
          }
        });
        for (const card of cards) {
          var ok = true;
          for (const filter_value of filter_values) {
            if (!filter_value.value) continue;
            if (filter_value.type === 'prop') {
              if (filter_value.value === 'not' && !card.data[filter_value.data]) {
                break;
              }
              if (filter_value.value === 'is' && card.data[filter_value.data]) {
                break;
              }
              ok = false;
              break;
            } else if (Array.isArray(filter_value.value)) {
              for (const v of filter_value.value) {
                if (card.data[filter_value.data].toLowerCase().indexOf(v.toLowerCase()) === -1) {
                  ok = false;
                  break;
                }
              }
            } else if ((card.data[filter_value.data] + '').toLowerCase().indexOf(filter_value.value.toLowerCase()) === -1) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          wrapper.append(card.html);
          updated++;
        }

        info.text(updated + ' / ' + cards.length)
        
        setCookie('form', cookiedata);
      };

      const data = getCookie('form');

      sort.val(data.sort);
      for (const filter_data of data.filters) {
        filters.filter('[data-filter=' + filter_data.data + ']').val(filter_data.original);
      }
      for (const filter_data of data.properties) {
        properties.filter('[value=' + filter_data.original + ']').prop('checked', true);
      }
      if (data.open) {
        more.attr('open', '');
      }
      update();
      
      sort.on('change', update);
      properties.on('change', update);
      filters.on('keyup', update);

      form.find('.form__reset').on('click', function() {
        do_update = false;
        filters.val('');
        sort.val('serial__asc');
        properties.prop('checked', false);
        do_update = true;
        update();
      });
    });

  });

})(jQuery);